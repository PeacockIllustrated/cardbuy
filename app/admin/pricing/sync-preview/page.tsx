import Link from "next/link";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import {
  PHASE3_SLICE1_SETS,
  fetchPrices,
  fetchProducts,
  resolveGroupIds,
  type TcgPrice,
  type TcgProduct,
} from "@/lib/pricing/tcgcsv";

/**
 * Phase 3 slice 1 verification page.
 *
 * Hits TCGCSV live every render (no cache) and renders what came
 * back so the operator can eyeball the data shape before we commit
 * to a migration + mapping schema.
 *
 * Admin-gated by middleware (same as the rest of /admin/*). No DB
 * writes anywhere on this page.
 */

// Disable Next's data cache for this route — we always want fresh.
export const dynamic = "force-dynamic";
export const revalidate = 0;

type FetchResult<T> = { ok: true; value: T; ms: number } | { ok: false; error: string; ms: number };

async function timed<T>(fn: () => Promise<T>): Promise<FetchResult<T>> {
  const t0 = performance.now();
  try {
    const value = await fn();
    return { ok: true, value, ms: Math.round(performance.now() - t0) };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      ms: Math.round(performance.now() - t0),
    };
  }
}

function fmtUSD(n: number | null): string {
  if (n == null) return "—";
  return `$${n.toFixed(2)}`;
}

/** Pull the card `Number` field out of TCGCSV's extendedData array. */
function productNumber(p: TcgProduct): string | null {
  return p.extendedData.find((x) => x.name === "Number")?.value ?? null;
}

function productRarity(p: TcgProduct): string | null {
  return p.extendedData.find((x) => x.name === "Rarity")?.value ?? null;
}

export default async function SyncPreviewPage() {
  // 1. Resolve the 6 first-gen set ids in parallel with a single /groups call.
  const groupsResult = await timed(() => resolveGroupIds(PHASE3_SLICE1_SETS));

  // 2. For Base Set specifically, fetch products + prices so we can preview
  //    the join shape. Only fires if we successfully resolved base1.
  const base1GroupId =
    groupsResult.ok ? groupsResult.value.base1 : null;

  const productsResult = base1GroupId
    ? await timed(() => fetchProducts(base1GroupId))
    : null;

  const pricesResult = base1GroupId
    ? await timed(() => fetchPrices(base1GroupId))
    : null;

  // Build productId → product lookup for joining to price rows.
  const productById = new Map<number, TcgProduct>();
  if (productsResult?.ok) {
    for (const p of productsResult.value) productById.set(p.productId, p);
  }

  // Sort prices by productNumber ascending (stable preview order).
  // Rows whose product is missing from productById sort to the end.
  const pricesSorted: TcgPrice[] = pricesResult?.ok
    ? [...pricesResult.value].sort((a, b) => {
        const ap = productById.get(a.productId);
        const bp = productById.get(b.productId);
        const an = ap ? Number(productNumber(ap) ?? 9999) : 9999;
        const bn = bp ? Number(productNumber(bp) ?? 9999) : 9999;
        return an - bn || a.subTypeName.localeCompare(b.subTypeName);
      })
    : [];

  return (
    <div className="px-4 py-6 max-w-[1200px] mx-auto flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <span className="font-display text-[10px] tracking-wider text-muted">
          Phase 3 · Slice 1 · Verification
        </span>
        <h1 className="font-display text-[32px] leading-none tracking-tight">
          TCGCSV sync preview
        </h1>
        <p className="text-secondary text-[13px] max-w-[72ch]">
          Live fetch of TCGCSV (no cache, no DB writes). Refresh the page to
          re-pull. Use this to confirm set-name mapping and the raw
          price-row shape before we commit to schema.
        </p>
        <div className="flex gap-3 pt-2">
          <Link
            href="/admin/pricing"
            className="font-display text-[11px] tracking-wider underline underline-offset-4"
          >
            ← Back to /admin/pricing
          </Link>
        </div>
      </header>

      {/* ---------- 1 · Set → groupId resolution ---------- */}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-[18px] tracking-tight">
          1 · Set mapping
          {groupsResult.ok ? (
            <span className="ml-3 font-sans font-normal text-[11px] text-muted tracking-normal">
              resolved in {groupsResult.ms}ms
            </span>
          ) : null}
        </h2>

        {!groupsResult.ok ? (
          <ErrorBlock title="resolveGroupIds failed" detail={groupsResult.error} />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Local set id</TH>
                <TH>Expected TCGCSV name</TH>
                <TH>Resolved groupId</TH>
                <TH>Match?</TH>
              </TR>
            </THead>
            <TBody>
              {Object.entries(PHASE3_SLICE1_SETS).map(([localId, aliases]) => {
                const gid = groupsResult.value[localId];
                const tcgName = aliases[0]; // primary name; fallbacks still tried
                return (
                  <TR key={localId}>
                    <TD>
                      <code className="font-mono text-[13px]">{localId}</code>
                    </TD>
                    <TD>
                      {tcgName}
                      {aliases.length > 1 ? (
                        <span className="text-[10px] text-muted"> · +{aliases.length - 1} fallback</span>
                      ) : null}
                    </TD>
                    <TD>
                      {gid != null ? (
                        <code className="font-mono text-[13px]">{gid}</code>
                      ) : (
                        <span className="text-warn">—</span>
                      )}
                    </TD>
                    <TD>
                      {gid != null ? (
                        <span className="font-display text-[10px] tracking-wider bg-teal border-2 border-ink px-2 py-0.5">
                          MATCHED
                        </span>
                      ) : (
                        <span className="font-display text-[10px] tracking-wider bg-warn text-paper-strong border-2 border-ink px-2 py-0.5">
                          NOT FOUND
                        </span>
                      )}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </section>

      {/* ---------- 2 · Base Set products ---------- */}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-[18px] tracking-tight">
          2 · Base Set · products
          {productsResult?.ok ? (
            <span className="ml-3 font-sans font-normal text-[11px] text-muted tracking-normal">
              {productsResult.value.length} products · {productsResult.ms}ms
            </span>
          ) : null}
        </h2>

        {!base1GroupId ? (
          <p className="text-secondary text-[13px]">
            Skipped — <code>base1</code> did not resolve.
          </p>
        ) : !productsResult?.ok ? (
          <ErrorBlock title="fetchProducts(base1) failed" detail={productsResult?.error ?? "unknown"} />
        ) : (
          <p className="text-secondary text-[13px]">
            {productsResult.value.length} products returned. Fetched the full
            set; only joined rows appear in the price preview below.
          </p>
        )}
      </section>

      {/* ---------- 3 · Base Set prices (joined with product data) ---------- */}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-[18px] tracking-tight">
          3 · Base Set · price rows
          {pricesResult?.ok ? (
            <span className="ml-3 font-sans font-normal text-[11px] text-muted tracking-normal">
              {pricesResult.value.length} rows · {pricesResult.ms}ms
            </span>
          ) : null}
        </h2>

        {!base1GroupId ? (
          <p className="text-secondary text-[13px]">
            Skipped — <code>base1</code> did not resolve.
          </p>
        ) : !pricesResult?.ok ? (
          <ErrorBlock title="fetchPrices(base1) failed" detail={pricesResult?.error ?? "unknown"} />
        ) : pricesSorted.length === 0 ? (
          <p className="text-secondary text-[13px]">No price rows returned.</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>#</TH>
                <TH>Card</TH>
                <TH>Rarity</TH>
                <TH>Variant</TH>
                <TH className="text-right">Market</TH>
                <TH className="text-right">Low</TH>
                <TH className="text-right">Mid</TH>
                <TH className="text-right">High</TH>
                <TH className="text-right">Direct low</TH>
              </TR>
            </THead>
            <TBody>
              {pricesSorted.slice(0, 60).map((price, i) => {
                const prod = productById.get(price.productId);
                const num = prod ? productNumber(prod) : null;
                const rarity = prod ? productRarity(prod) : null;
                return (
                  <TR key={`${price.productId}-${price.subTypeName}`}>
                    <TD>
                      <span className="font-mono text-[12px] text-muted">
                        {num ?? "?"}
                      </span>
                    </TD>
                    <TD>
                      {prod?.name ?? (
                        <span className="text-muted">
                          (product {price.productId} not found)
                        </span>
                      )}
                    </TD>
                    <TD>
                      <span className="text-[12px] text-secondary">
                        {rarity ?? "—"}
                      </span>
                    </TD>
                    <TD>
                      <span className="font-display text-[10px] tracking-wider bg-paper border-2 border-ink px-2 py-0.5">
                        {price.subTypeName}
                      </span>
                    </TD>
                    <TD className="text-right font-mono">{fmtUSD(price.marketPrice)}</TD>
                    <TD className="text-right font-mono text-muted">{fmtUSD(price.lowPrice)}</TD>
                    <TD className="text-right font-mono text-muted">{fmtUSD(price.midPrice)}</TD>
                    <TD className="text-right font-mono text-muted">{fmtUSD(price.highPrice)}</TD>
                    <TD className="text-right font-mono text-muted">{fmtUSD(price.directLowPrice)}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
        {pricesResult?.ok && pricesSorted.length > 60 ? (
          <p className="text-secondary text-[11px] italic">
            Showing first 60 of {pricesSorted.length}. Full list pulls on sync.
          </p>
        ) : null}
      </section>
    </div>
  );
}

function ErrorBlock({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="border-[3px] border-ink bg-warn text-paper-strong px-4 py-3 rounded-md">
      <div className="font-display text-[13px] tracking-wider">{title}</div>
      <code className="block mt-1 text-[12px] font-mono text-paper-strong/90 whitespace-pre-wrap">
        {detail}
      </code>
    </div>
  );
}
