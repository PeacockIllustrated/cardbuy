import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCardById, getAllSets, setIdOf } from "@/lib/fixtures/cards";
import {
  listGroups,
  listProducts,
  listPrices,
  extractCardNumber,
  extractRarity,
  type TcgcsvProduct,
  type TcgcsvPriceRow,
} from "./tcgcsv";
import { mapGroupToSet, resolveCardId } from "./mapping";

/**
 * Orchestrates one sync run:
 *   1. List all TCGCSV groups (Pokemon = categoryId 3, ~215 groups)
 *   2. For each group with a confident pokemontcg.io set match:
 *      a. Fetch products + prices in parallel
 *      b. Resolve TCGplayer productIds to our pokemontcg.io card ids
 *      c. Upsert lewis_cards (catalogue) + lewis_card_prices (latest)
 *      d. Append today's snapshot to lewis_card_price_history
 *   3. Log run stats into lewis_sync_runs
 *
 * Designed to be re-runnable — same day = same snapshot rows
 * (UNIQUE on (card_id, source, variant, snapshotted_on) makes the
 * second insert a no-op via ON CONFLICT).
 *
 * Concurrency: processes 8 groups in parallel. ~215 groups / 8 = 27
 * batches × ~600ms per batch = roughly 16 seconds end-to-end.
 */

const PARALLELISM = 8;
const SOURCE = "tcgplayer" as const;

export type SyncResult = {
  runId: string;
  status: "success" | "partial" | "failed";
  setsProcessed: number;
  setsSkipped: number;
  cardsUpserted: number;
  pricesUpserted: number;
  durationMs: number;
  errors: Array<{ group?: string; reason: string }>;
};

type ChunkResult = {
  setName: string;
  cardsUpserted: number;
  pricesUpserted: number;
  errors: Array<{ group?: string; reason: string }>;
};

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function runPriceSync(): Promise<SyncResult> {
  const started = Date.now();
  const supabase = createAdminClient();

  // 0. Open a sync-run row so the admin panel can see "running…".
  const { data: run } = await supabase
    .from("lewis_sync_runs")
    .insert({ kind: "prices", source: SOURCE, status: "running" })
    .select("id")
    .single();
  const runId = (run as { id: string } | null)?.id ?? "(no run row)";

  let setsProcessed = 0;
  let setsSkipped = 0;
  let cardsUpserted = 0;
  let pricesUpserted = 0;
  const errors: SyncResult["errors"] = [];

  try {
    const groups = await listGroups();

    // Sanity: only process groups where we have a confident set link.
    const linkedGroups = groups
      .map((g) => ({ group: g, link: mapGroupToSet(g) }))
      .filter(
        (x): x is { group: typeof x.group; link: NonNullable<typeof x.link> } =>
          x.link !== null,
      );

    setsSkipped = groups.length - linkedGroups.length;

    // Per-group worker
    const processOne = async (
      group: (typeof linkedGroups)[number],
    ): Promise<ChunkResult> => {
      const r: ChunkResult = {
        setName: group.link.name,
        cardsUpserted: 0,
        pricesUpserted: 0,
        errors: [],
      };
      try {
        const [products, prices] = await Promise.all([
          listProducts(group.group.groupId),
          listPrices(group.group.groupId),
        ]);

        // Build product map for quick join with prices.
        const productById = new Map<number, TcgcsvProduct>();
        for (const p of products) productById.set(p.productId, p);

        // Pre-resolve every product to our card id.
        type ResolvedProduct = {
          tcgPid: number;
          tcgGid: number;
          cardId: string;
          name: string;
          imageUrl: string | null;
          cardNumber: string | null;
          rarity: string | null;
        };
        const resolved: ResolvedProduct[] = [];
        for (const p of products) {
          const number = extractCardNumber(p);
          const cardId = resolveCardId(group.link.id, number);
          if (!cardId) continue;
          // Verify it's a real card in our fixture (catches edge cases
          // like "Booster Box" products and SKU-only entries).
          if (!getCardById(cardId)) continue;
          resolved.push({
            tcgPid: p.productId,
            tcgGid: p.groupId,
            cardId,
            name: p.cleanName,
            imageUrl: p.imageUrl,
            cardNumber: number,
            rarity: extractRarity(p),
          });
        }

        if (resolved.length === 0) return r;

        // Upsert lewis_cards (catalogue cache)
        const cardRows = resolved.map((rp) => {
          const c = getCardById(rp.cardId);
          return {
            id: rp.cardId,
            name: c?.name ?? rp.name,
            set_id: setIdOf(c!),
            set_name: group.link.name,
            card_number: rp.cardNumber,
            rarity: c?.rarity ?? rp.rarity,
            supertype: c?.supertype,
            language: "EN",
            image_url_small: c?.images.small ?? null,
            image_url_large: c?.images.large ?? rp.imageUrl,
            tcgplayer_product_id: rp.tcgPid,
            tcgplayer_group_id: rp.tcgGid,
            last_synced_at: new Date().toISOString(),
          };
        });

        const { error: cardErr } = await supabase
          .from("lewis_cards")
          .upsert(cardRows, { onConflict: "id" });
        if (cardErr) {
          r.errors.push({ group: group.link.name, reason: cardErr.message });
          return r;
        }
        r.cardsUpserted = cardRows.length;

        // Upsert lewis_card_prices — one row per (card, variant)
        const priceRows: Array<Record<string, unknown>> = [];
        const historyRows: Array<Record<string, unknown>> = [];
        const fetchedAt = new Date().toISOString();
        const today = fetchedAt.slice(0, 10); // YYYY-MM-DD

        const cardIdByProductId = new Map<number, string>();
        for (const rp of resolved) cardIdByProductId.set(rp.tcgPid, rp.cardId);

        for (const price of prices as TcgcsvPriceRow[]) {
          const cardId = cardIdByProductId.get(price.productId);
          if (!cardId) continue;
          priceRows.push({
            card_id: cardId,
            source: SOURCE,
            variant: price.subTypeName,
            currency: "USD",
            price_low: price.lowPrice,
            price_mid: price.midPrice,
            price_market: price.marketPrice,
            price_high: price.highPrice,
            source_updated_at: fetchedAt,
            fetched_at: fetchedAt,
          });
          historyRows.push({
            card_id: cardId,
            source: SOURCE,
            variant: price.subTypeName,
            currency: "USD",
            price_market: price.marketPrice,
            price_low: price.lowPrice,
            source_updated_at: fetchedAt,
            snapshotted_on: today,
          });
        }

        if (priceRows.length > 0) {
          const { error: priceErr } = await supabase
            .from("lewis_card_prices")
            .upsert(priceRows, {
              onConflict: "card_id,source,variant",
            });
          if (priceErr) {
            r.errors.push({
              group: group.link.name,
              reason: `prices upsert: ${priceErr.message}`,
            });
          } else {
            r.pricesUpserted = priceRows.length;
          }

          const { error: histErr } = await supabase
            .from("lewis_card_price_history")
            .upsert(historyRows, {
              onConflict: "card_id,source,variant,snapshotted_on",
            });
          if (histErr) {
            r.errors.push({
              group: group.link.name,
              reason: `history upsert: ${histErr.message}`,
            });
          }
        }
      } catch (e) {
        r.errors.push({
          group: group.link.name,
          reason: e instanceof Error ? e.message : String(e),
        });
      }
      return r;
    };

    // Run in batches of PARALLELISM
    for (const batch of chunk(linkedGroups, PARALLELISM)) {
      const results = await Promise.all(batch.map(processOne));
      for (const r of results) {
        setsProcessed += 1;
        cardsUpserted += r.cardsUpserted;
        pricesUpserted += r.pricesUpserted;
        errors.push(...r.errors);
      }
    }

    const status: SyncResult["status"] =
      errors.length === 0
        ? "success"
        : errors.length < linkedGroups.length
          ? "partial"
          : "failed";

    // Close the run row
    await supabase
      .from("lewis_sync_runs")
      .update({
        finished_at: new Date().toISOString(),
        status,
        sets_processed: setsProcessed,
        cards_upserted: cardsUpserted,
        prices_upserted: pricesUpserted,
        errors: errors.slice(0, 100), // cap to keep the row sane
        notes: `Skipped ${setsSkipped} unmatched groups`,
      })
      .eq("id", runId);

    return {
      runId,
      status,
      setsProcessed,
      setsSkipped,
      cardsUpserted,
      pricesUpserted,
      durationMs: Date.now() - started,
      errors,
    };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    errors.push({ reason });
    await supabase
      .from("lewis_sync_runs")
      .update({
        finished_at: new Date().toISOString(),
        status: "failed",
        sets_processed: setsProcessed,
        cards_upserted: cardsUpserted,
        prices_upserted: pricesUpserted,
        errors: errors.slice(0, 100),
      })
      .eq("id", runId);
    return {
      runId,
      status: "failed",
      setsProcessed,
      setsSkipped,
      cardsUpserted,
      pricesUpserted,
      durationMs: Date.now() - started,
      errors,
    };
  }
}

// Use getAllSets to silence the unused-import lint when this file
// grows further sync helpers; today it's only re-exported.
export { getAllSets };
