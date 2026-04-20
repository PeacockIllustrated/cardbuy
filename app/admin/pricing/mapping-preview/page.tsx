import Link from "next/link";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { getCardsBySet } from "@/lib/fixtures/cards";
import {
  PHASE3_SLICE1_SETS,
  fetchProducts,
  resolveGroupIds,
  sleepPolite,
} from "@/lib/pricing/tcgcsv";
import {
  buildMapping,
  type MappingResult,
} from "@/lib/pricing/build-mapping";

/**
 * Phase 3 slice 2 verification page.
 *
 * Builds the full card → productId mapping for base1-5 + basep and
 * renders every issue inline so the operator can eyeball matching
 * quality before we commit the mapping to a DB table in slice 3.
 *
 * No DB writes. Live-fetches TCGCSV on every render.
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PerSet = {
  setId: string;
  tcgName: string;
  groupId: number | null;
  result: MappingResult | null;
  error: string | null;
  ms: number;
};

export default async function MappingPreviewPage() {
  const t0 = performance.now();

  // 1 · Resolve the 6 first-gen groupIds in one /groups call.
  let groupMap: Record<string, number | null> = {};
  let resolveError: string | null = null;
  try {
    groupMap = await resolveGroupIds(PHASE3_SLICE1_SETS);
  } catch (e) {
    resolveError = e instanceof Error ? e.message : String(e);
  }

  // 2 · For each set, fetch products (serialised with politeness) and
  //     build the mapping against our local catalogue.
  const perSet: PerSet[] = [];
  for (const [setId, tcgName] of Object.entries(PHASE3_SLICE1_SETS)) {
    const groupId = groupMap[setId] ?? null;
    const sStart = performance.now();
    if (!groupId) {
      perSet.push({
        setId,
        tcgName,
        groupId: null,
        result: null,
        error: "groupId did not resolve",
        ms: 0,
      });
      continue;
    }
    try {
      if (perSet.length > 0) await sleepPolite();
      const products = await fetchProducts(groupId);
      const localCards = getCardsBySet(setId);
      const result = buildMapping(setId, localCards, products);
      perSet.push({
        setId,
        tcgName,
        groupId,
        result,
        error: null,
        ms: Math.round(performance.now() - sStart),
      });
    } catch (e) {
      perSet.push({
        setId,
        tcgName,
        groupId,
        result: null,
        error: e instanceof Error ? e.message : String(e),
        ms: Math.round(performance.now() - sStart),
      });
    }
  }

  const totalMs = Math.round(performance.now() - t0);

  // Totals across all sets.
  const totals = perSet.reduce(
    (acc, s) => {
      if (!s.result) return acc;
      acc.matched += s.result.matched.length;
      acc.exact += s.result.matched.filter((m) => m.confidence === "exact").length;
      acc.numberOnly += s.result.matched.filter((m) => m.confidence === "number-only").length;
      acc.nameFuzzy += s.result.matched.filter((m) => m.confidence === "name-fuzzy").length;
      acc.ambiguous += s.result.ambiguous.length;
      acc.unmatched += s.result.unmatched.length;
      acc.orphans += s.result.orphans.length;
      acc.localTotal += (s.result.matched.length + s.result.ambiguous.length + s.result.unmatched.length);
      return acc;
    },
    {
      matched: 0,
      exact: 0,
      numberOnly: 0,
      nameFuzzy: 0,
      ambiguous: 0,
      unmatched: 0,
      orphans: 0,
      localTotal: 0,
    },
  );

  return (
    <div className="px-4 py-6 max-w-[1300px] mx-auto flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <span className="font-display text-[10px] tracking-wider text-muted">
          Phase 3 · Slice 2 · Card ↔ productId mapping
        </span>
        <h1 className="font-display text-[32px] leading-none tracking-tight">
          TCGCSV mapping preview
        </h1>
        <p className="text-secondary text-[13px] max-w-[72ch]">
          Builds the <code>card_id → productId</code> lookup for base1–5 +
          basep. Issues (ambiguous, unmatched, orphans) are listed inline so
          you can sign off matching quality before slice 3 commits the
          mapping to a table. Refresh to re-fetch.
        </p>
        <div className="flex gap-4 pt-1">
          <Link href="/admin/pricing" className="font-display text-[11px] tracking-wider underline underline-offset-4">
            ← /admin/pricing
          </Link>
          <Link href="/admin/pricing/sync-preview" className="font-display text-[11px] tracking-wider underline underline-offset-4">
            /admin/pricing/sync-preview →
          </Link>
        </div>
      </header>

      {/* ---------- Totals ---------- */}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-[18px] tracking-tight">
          Totals
          <span className="ml-3 font-sans font-normal text-[11px] text-muted tracking-normal">
            {totalMs}ms end-to-end · {perSet.length} sets
          </span>
        </h2>

        {resolveError ? (
          <ErrorBlock title="resolveGroupIds failed" detail={resolveError} />
        ) : null}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Tile label="Matched" value={totals.matched} of={totals.localTotal} tone="teal" />
          <Tile label="Ambiguous" value={totals.ambiguous} tone={totals.ambiguous > 0 ? "pink" : "paper"} />
          <Tile label="Unmatched" value={totals.unmatched} tone={totals.unmatched > 0 ? "warn" : "paper"} />
          <Tile label="Orphan TCG products" value={totals.orphans} tone="yellow" />
        </div>

        <div className="grid grid-cols-3 gap-3 pt-1">
          <SubTile label="Exact (number + name)" value={totals.exact} total={totals.matched} tone="teal" />
          <SubTile label="Number-only (name mismatch)" value={totals.numberOnly} total={totals.matched} tone={totals.numberOnly > 0 ? "yellow" : "paper"} />
          <SubTile label="Name-fuzzy (no number)" value={totals.nameFuzzy} total={totals.matched} tone={totals.nameFuzzy > 0 ? "pink" : "paper"} />
        </div>
      </section>

      {/* ---------- Per-set summary ---------- */}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-[18px] tracking-tight">Per-set summary</h2>
        <Table>
          <THead>
            <TR>
              <TH>Local set</TH>
              <TH>TCG name</TH>
              <TH>groupId</TH>
              <TH className="text-right">Cards</TH>
              <TH className="text-right">TCG products</TH>
              <TH className="text-right">Matched</TH>
              <TH className="text-right">Ambig.</TH>
              <TH className="text-right">Unmatched</TH>
              <TH className="text-right">Orphans</TH>
              <TH className="text-right">Time</TH>
            </TR>
          </THead>
          <TBody>
            {perSet.map((s) => {
              const totalLocal = s.result
                ? s.result.matched.length + s.result.ambiguous.length + s.result.unmatched.length
                : 0;
              const totalTcg = s.result
                ? s.result.matched.length + s.result.orphans.length
                : 0;
              return (
                <TR key={s.setId}>
                  <TD><code className="font-mono">{s.setId}</code></TD>
                  <TD>{s.tcgName}</TD>
                  <TD>
                    {s.groupId != null ? (
                      <code className="font-mono">{s.groupId}</code>
                    ) : (
                      <span className="text-warn">—</span>
                    )}
                  </TD>
                  <TD className="text-right font-mono">{totalLocal || "—"}</TD>
                  <TD className="text-right font-mono">{totalTcg || "—"}</TD>
                  <TD className="text-right font-mono">
                    {s.result ? (
                      <span>
                        {s.result.matched.length}
                        <span className="text-[11px] text-muted"> / {totalLocal}</span>
                      </span>
                    ) : "—"}
                  </TD>
                  <TD className={`text-right font-mono ${s.result && s.result.ambiguous.length > 0 ? "text-pink font-bold" : ""}`}>
                    {s.result ? s.result.ambiguous.length : "—"}
                  </TD>
                  <TD className={`text-right font-mono ${s.result && s.result.unmatched.length > 0 ? "text-warn font-bold" : ""}`}>
                    {s.result ? s.result.unmatched.length : "—"}
                  </TD>
                  <TD className="text-right font-mono">{s.result ? s.result.orphans.length : "—"}</TD>
                  <TD className="text-right font-mono text-[11px] text-muted">{s.ms}ms</TD>
                </TR>
              );
            })}
          </TBody>
        </Table>

        {perSet.some((s) => s.error) ? (
          <div className="flex flex-col gap-2">
            {perSet.filter((s) => s.error).map((s) => (
              <ErrorBlock key={s.setId} title={`${s.setId} failed`} detail={s.error!} />
            ))}
          </div>
        ) : null}
      </section>

      {/* ---------- Issues · ambiguous ---------- */}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-[18px] tracking-tight">
          Ambiguous matches
          <span className="ml-3 font-sans font-normal text-[11px] text-muted tracking-normal">
            {totals.ambiguous} rows · need manual pick
          </span>
        </h2>
        {totals.ambiguous === 0 ? (
          <Good>No ambiguous matches. Every local card found exactly one or zero TCG candidates.</Good>
        ) : (
          <div className="flex flex-col gap-4">
            {perSet.map((s) =>
              !s.result || s.result.ambiguous.length === 0 ? null : (
                <SubSection key={s.setId} title={`${s.setId} · ${s.result.ambiguous.length} ambiguous`}>
                  <Table>
                    <THead>
                      <TR>
                        <TH>Card id</TH>
                        <TH>Name</TH>
                        <TH>#</TH>
                        <TH>Reason</TH>
                        <TH>Candidate productIds</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {s.result.ambiguous.map((row) => (
                        <TR key={row.cardId}>
                          <TD><code className="font-mono">{row.cardId}</code></TD>
                          <TD>{row.cardName}</TD>
                          <TD><code className="font-mono">{row.cardNumber}</code></TD>
                          <TD className="text-[12px] text-secondary">{row.reason}</TD>
                          <TD>
                            <ul className="text-[12px]">
                              {row.candidates.map((c) => (
                                <li key={c.productId}>
                                  <code className="font-mono">{c.productId}</code> · {c.productName}
                                  {c.productNumber ? ` · #${c.productNumber}` : ""}
                                </li>
                              ))}
                            </ul>
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </SubSection>
              ),
            )}
          </div>
        )}
      </section>

      {/* ---------- Issues · unmatched ---------- */}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-[18px] tracking-tight">
          Unmatched local cards
          <span className="ml-3 font-sans font-normal text-[11px] text-muted tracking-normal">
            {totals.unmatched} rows · no TCG product found
          </span>
        </h2>
        {totals.unmatched === 0 ? (
          <Good>Every local card matched a TCG product.</Good>
        ) : (
          <div className="flex flex-col gap-4">
            {perSet.map((s) =>
              !s.result || s.result.unmatched.length === 0 ? null : (
                <SubSection key={s.setId} title={`${s.setId} · ${s.result.unmatched.length} unmatched`}>
                  <Table>
                    <THead>
                      <TR>
                        <TH>Card id</TH>
                        <TH>Name</TH>
                        <TH>#</TH>
                        <TH>Rarity</TH>
                        <TH>Reason</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {s.result.unmatched.map((row) => (
                        <TR key={row.cardId}>
                          <TD><code className="font-mono">{row.cardId}</code></TD>
                          <TD>{row.cardName}</TD>
                          <TD><code className="font-mono">{row.cardNumber}</code></TD>
                          <TD className="text-[12px] text-secondary">{row.rarity ?? "—"}</TD>
                          <TD className="text-[12px] text-secondary">{row.reason}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </SubSection>
              ),
            )}
          </div>
        )}
      </section>

      {/* ---------- Issues · number-only + name-fuzzy ---------- */}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-[18px] tracking-tight">
          Low-confidence matches
          <span className="ml-3 font-sans font-normal text-[11px] text-muted tracking-normal">
            {totals.numberOnly + totals.nameFuzzy} rows · review before committing
          </span>
        </h2>
        {totals.numberOnly + totals.nameFuzzy === 0 ? (
          <Good>All matches are exact (number + name both agree).</Good>
        ) : (
          <div className="flex flex-col gap-4">
            {perSet.map((s) => {
              const low = s.result?.matched.filter((m) => m.confidence !== "exact") ?? [];
              if (low.length === 0) return null;
              return (
                <SubSection key={s.setId} title={`${s.setId} · ${low.length} low-confidence`}>
                  <Table>
                    <THead>
                      <TR>
                        <TH>Card id</TH>
                        <TH>Local name</TH>
                        <TH>#</TH>
                        <TH>→ productId</TH>
                        <TH>TCG name</TH>
                        <TH>Confidence</TH>
                        <TH>Note</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {low.map((m) => (
                        <TR key={`${m.cardId}-${m.productId}`}>
                          <TD><code className="font-mono">{m.cardId}</code></TD>
                          <TD>{m.cardName}</TD>
                          <TD><code className="font-mono">{m.cardNumber}</code></TD>
                          <TD><code className="font-mono">{m.productId}</code></TD>
                          <TD>{m.productName}</TD>
                          <TD>
                            <span className={`font-display text-[10px] tracking-wider border-2 border-ink px-2 py-0.5 ${m.confidence === "number-only" ? "bg-yellow" : "bg-pink"}`}>
                              {m.confidence}
                            </span>
                          </TD>
                          <TD className="text-[12px] text-secondary">{m.notes.join(" · ")}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </SubSection>
              );
            })}
          </div>
        )}
      </section>

      {/* ---------- Orphans ---------- */}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-[18px] tracking-tight">
          Orphan TCG products
          <span className="ml-3 font-sans font-normal text-[11px] text-muted tracking-normal">
            {totals.orphans} rows · no local card points at them
          </span>
        </h2>
        {totals.orphans === 0 ? (
          <Good>Every TCG product was claimed by a local card.</Good>
        ) : (
          <div className="flex flex-col gap-4">
            {perSet.map((s) =>
              !s.result || s.result.orphans.length === 0 ? null : (
                <SubSection key={s.setId} title={`${s.setId} · ${s.result.orphans.length} orphan${s.result.orphans.length === 1 ? "" : "s"}`}>
                  <Table>
                    <THead>
                      <TR>
                        <TH>productId</TH>
                        <TH>TCG name</TH>
                        <TH>#</TH>
                        <TH>Likely reason</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {s.result.orphans.slice(0, 30).map((o) => (
                        <TR key={o.productId}>
                          <TD><code className="font-mono">{o.productId}</code></TD>
                          <TD>{o.productName}</TD>
                          <TD><code className="font-mono">{o.productNumber ?? "—"}</code></TD>
                          <TD className="text-[12px] text-secondary">{o.reason}</TD>
                        </TR>
                      ))}
                      {s.result.orphans.length > 30 ? (
                        <TR>
                          <TD colSpan={4} className="text-[11px] text-muted italic">
                            … {s.result.orphans.length - 30} more
                          </TD>
                        </TR>
                      ) : null}
                    </TBody>
                  </Table>
                </SubSection>
              ),
            )}
          </div>
        )}
      </section>

      <p className="text-[11px] text-muted italic pt-4">
        Slice 3 next: once these numbers look acceptable, we migrate the
        mapping into <code>lewis_card_tcg_map</code> and wire the sync
        job to write <code>lewis_prices</code>.
      </p>
    </div>
  );
}

// ----------------------------------------------------------------
// Small presentation helpers (kept in-file so the slice stays self-
// contained — these move to a shared location once repeated).
// ----------------------------------------------------------------

function Tile({
  label,
  value,
  of,
  tone,
}: {
  label: string;
  value: number;
  of?: number;
  tone: "teal" | "pink" | "yellow" | "warn" | "paper";
}) {
  const bg =
    tone === "teal" ? "bg-teal"
    : tone === "pink" ? "bg-pink"
    : tone === "yellow" ? "bg-yellow"
    : tone === "warn" ? "bg-warn text-paper-strong"
    : "bg-paper-strong";
  return (
    <div className={`border-[3px] border-ink rounded-md shadow-[4px_4px_0_0_var(--color-ink)] p-4 ${bg}`}>
      <div className="font-display text-[10px] tracking-wider uppercase">{label}</div>
      <div className="font-display text-[32px] leading-none tracking-tight tabular-nums mt-1">
        {value}
        {of != null ? (
          <span className="text-[14px] text-ink/60"> / {of}</span>
        ) : null}
      </div>
    </div>
  );
}

function SubTile({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: "teal" | "pink" | "yellow" | "paper";
}) {
  const bg =
    tone === "teal" ? "bg-teal/60"
    : tone === "pink" ? "bg-pink/50"
    : tone === "yellow" ? "bg-yellow/60"
    : "bg-paper-strong";
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className={`border-2 border-ink rounded-md p-3 ${bg}`}>
      <div className="font-display text-[10px] tracking-wider uppercase">{label}</div>
      <div className="font-display text-[18px] leading-none tracking-tight tabular-nums mt-1">
        {value}
        <span className="text-[11px] text-ink/60"> · {pct}%</span>
      </div>
    </div>
  );
}

function Good({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-2 border-ink bg-teal/30 px-4 py-2 rounded-md text-[13px]">
      ✓ {children}
    </div>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-display text-[12px] tracking-wider uppercase text-secondary">{title}</h3>
      {children}
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
