"use server";

// NOTE: "use server" files may ONLY export async functions. No type
// re-exports, no sync helpers, no constants. Types live in
// `lib/prices/types.ts`; import from there at the call site.

import { cache } from "react";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runPriceSync } from "@/lib/sync/sync-prices";
import { runFxSync } from "@/lib/sync/sync-fx";
import type { LivePriceRow, SyncRunSummary } from "@/lib/prices/types";

/**
 * Per-request reader for the latest snapshot row(s) in
 * `lewis_card_prices` for a single card. Returns `[]` when the sync
 * hasn't covered this card — callers fall back to mock data.
 *
 * Wrapped in React's `cache()` so multiple components in the same
 * render dedupe to one Supabase round-trip.
 */
export const getLatestPricesForCard = cache(
  async (cardId: string): Promise<LivePriceRow[]> => {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("lewis_card_prices")
        .select("*")
        .eq("card_id", cardId);
      if (error || !data) return [];
      return data as LivePriceRow[];
    } catch {
      return [];
    }
  },
);

/**
 * Bulk reader for many cards in one round-trip — used by grid views
 * (the /search tile overlay) so we don't fan out one Supabase query
 * per card. Silently degrades to an empty Map on error so callers
 * fall back to mock prices without breaking the page.
 */
export const getLatestPricesForCards = cache(
  async (cardIds: string[]): Promise<Map<string, LivePriceRow[]>> => {
    const result = new Map<string, LivePriceRow[]>();
    if (cardIds.length === 0) return result;
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("lewis_card_prices")
        .select("*")
        .in("card_id", cardIds);
      if (error || !data) return result;
      for (const row of data as LivePriceRow[]) {
        const bucket = result.get(row.card_id);
        if (bucket) bucket.push(row);
        else result.set(row.card_id, [row]);
      }
      return result;
    } catch {
      return result;
    }
  },
);

export async function getRecentSyncRuns(
  limit = 8,
): Promise<SyncRunSummary[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("lewis_sync_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(limit);
    return ((data as SyncRunSummary[] | null) ?? []);
  } catch {
    return [];
  }
}

/**
 * Admin-only: trigger the TCGCSV price sync immediately, server-side.
 * Reuses the same orchestration as the nightly Vercel cron — just
 * skips the HTTP boundary so we don't need to ship CRON_SECRET to
 * the browser.
 */
export async function triggerPriceSync(): Promise<
  | {
      ok: true;
      runId: string;
      status: "success" | "partial" | "failed";
      setsProcessed: number;
      cardsUpserted: number;
      pricesUpserted: number;
      durationMs: number;
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: profile } = await supabase
    .from("lewis_users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if ((profile as { role?: string } | null)?.role !== "admin") {
    return { ok: false, error: "Admin only" };
  }

  try {
    const result = await runPriceSync();
    revalidatePath("/admin/sync");
    revalidatePath("/admin");
    return {
      ok: true,
      runId: result.runId,
      status: result.status,
      setsProcessed: result.setsProcessed,
      cardsUpserted: result.cardsUpserted,
      pricesUpserted: result.pricesUpserted,
      durationMs: result.durationMs,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/* ─────────────────────────────────────────────────────────────────
 * Phase 3 · Slice C · FX sync trigger.
 *
 * Admin-initiated "refresh FX now" — same entry point as the nightly
 * cron, just skips the HTTP boundary. Respects fx_manual_override.
 * ───────────────────────────────────────────────────────────────── */

export type TriggerFxResult =
  | {
      ok: true;
      runId: string;
      status: "success" | "skipped" | "failed";
      usdGbp?: number;
      usdEur?: number;
      durationMs: number;
      reason?: string;
    }
  | { ok: false; error: string };

export async function triggerFxSync(): Promise<TriggerFxResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: profile } = await supabase
    .from("lewis_users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if ((profile as { role?: string } | null)?.role !== "admin") {
    return { ok: false, error: "Admin only" };
  }

  try {
    const result = await runFxSync();
    revalidatePath("/admin/pricing");
    revalidatePath("/admin/sync");
    return {
      ok: true,
      runId: result.runId,
      status: result.status,
      usdGbp: result.usdGbp,
      usdEur: result.usdEur,
      durationMs: result.durationMs,
      reason: result.reason,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/* ─────────────────────────────────────────────────────────────────
 * Phase 3 · Slice A · mapping persistence.
 *
 * Runs the deterministic `buildMapping()` flow (the same one powering
 * /admin/pricing/mapping-preview) server-side, then UPSERTs each
 * matched row into `lewis_card_tcg_map` with `source='auto'`. Rows
 * already marked `source='manual-override'` are never overwritten —
 * those represent Lewis's hand-curated exceptions (e.g. the Base Set
 * Machamp Shadowless-group edge case).
 * ───────────────────────────────────────────────────────────────── */

export type CommitMappingsResult =
  | {
      ok: true;
      setId: string;
      writtenCount: number;
      skippedManualOverrides: number;
      matchedTotal: number;
    }
  | { ok: false; error: string };

export async function commitMappingsForSet(
  setId: string,
): Promise<CommitMappingsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: profile } = await supabase
    .from("lewis_users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if ((profile as { role?: string } | null)?.role !== "admin") {
    return { ok: false, error: "Admin only" };
  }

  try {
    const { getCardsBySet } = await import("@/lib/fixtures/cards");
    const { buildMapping } = await import("@/lib/pricing/build-mapping");
    const { PHASE3_SLICE1_SETS, fetchProducts, resolveGroupIds } =
      await import("@/lib/pricing/tcgcsv");

    const aliasesForSet = (PHASE3_SLICE1_SETS as Record<string, string[]>)[
      setId
    ];
    if (!aliasesForSet) {
      return {
        ok: false,
        error: `Set '${setId}' is not in PHASE3_SLICE1_SETS aliases.`,
      };
    }

    const groupMap = await resolveGroupIds({ [setId]: aliasesForSet });
    const groupId = groupMap[setId];
    if (!groupId) {
      return {
        ok: false,
        error: `Could not resolve TCGCSV groupId for '${setId}'.`,
      };
    }

    const [products, localCards] = await Promise.all([
      fetchProducts(groupId),
      Promise.resolve(getCardsBySet(setId)),
    ]);
    const result = buildMapping(setId, localCards, products);

    // Identify manual-override rows for the cards we're about to touch
    // so we don't stomp them.
    const cardIds = result.matched.map((m) => m.cardId);
    const { data: existing } = await supabase
      .from("lewis_card_tcg_map")
      .select("card_id, source")
      .in("card_id", cardIds);
    const manualOverrides = new Set(
      ((existing as { card_id: string; source: string }[] | null) ?? [])
        .filter((r) => r.source === "manual-override")
        .map((r) => r.card_id),
    );

    const rows = result.matched
      .filter((m) => !manualOverrides.has(m.cardId))
      .map((m) => ({
        card_id: m.cardId,
        product_id: m.productId,
        confidence: m.confidence,
        source: "auto" as const,
        tcg_group_id: groupId,
        notes: m.notes.length > 0 ? m.notes.join("; ") : null,
        updated_at: new Date().toISOString(),
      }));

    if (rows.length === 0) {
      return {
        ok: true,
        setId,
        writtenCount: 0,
        skippedManualOverrides: manualOverrides.size,
        matchedTotal: result.matched.length,
      };
    }

    const { error } = await supabase
      .from("lewis_card_tcg_map")
      .upsert(rows, { onConflict: "card_id" });
    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/pricing/mapping-preview");
    revalidatePath("/admin/sync");
    return {
      ok: true,
      setId,
      writtenCount: rows.length,
      skippedManualOverrides: manualOverrides.size,
      matchedTotal: result.matched.length,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function getCardCoverageStats(): Promise<{
  totalCards: number;
  withPrices: number;
  lastSyncAt: string | null;
}> {
  try {
    const supabase = await createClient();
    const [{ count: totalCards }, { count: withPrices }, { data: lastRun }] =
      await Promise.all([
        supabase.from("lewis_cards").select("id", { count: "exact", head: true }),
        supabase
          .from("lewis_card_prices")
          .select("card_id", { count: "exact", head: true }),
        supabase
          .from("lewis_sync_runs")
          .select("finished_at")
          .eq("status", "success")
          .order("finished_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
    return {
      totalCards: totalCards ?? 0,
      withPrices: withPrices ?? 0,
      lastSyncAt:
        (lastRun as { finished_at: string | null } | null)?.finished_at ?? null,
    };
  } catch {
    return { totalCards: 0, withPrices: 0, lastSyncAt: null };
  }
}
