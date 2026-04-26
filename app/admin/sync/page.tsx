import { Annotation } from "@/components/wireframe/Annotation";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatCard } from "@/components/admin/StatCard";
import {
  getRecentSyncRuns,
  getCardCoverageStats,
} from "@/app/_actions/prices";
import { TriggerSyncButton } from "./TriggerSyncButton";

export const metadata = { title: "Sync · cardbuy admin" };

const STATUS_TONES: Record<string, string> = {
  running: "bg-paper-strong text-ink",
  success: "bg-teal text-ink",
  partial: "bg-yellow text-ink",
  failed: "bg-warn text-paper-strong",
};

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toISOString().slice(0, 16).replace("T", " ");
}

function fmtDuration(start: string, end: string | null): string {
  if (!end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return `${(ms / 1000).toFixed(1)}s`;
}

export default async function AdminSyncPage() {
  const [runs, coverage] = await Promise.all([
    getRecentSyncRuns(20),
    getCardCoverageStats(),
  ]);

  const coveragePct =
    coverage.totalCards > 0
      ? Math.round((coverage.withPrices / coverage.totalCards) * 100)
      : 0;

  return (
    <div className="px-4 md:px-6 py-6 max-w-[1300px] mx-auto flex flex-col gap-6">
      <AdminPageHeader
        crumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Catalogue" },
          { label: "Sync" },
        ]}
        title="Catalogue sync"
        kicker={{ label: "CRON · 04:00 UTC", tone: "teal" }}
        subtitle="Nightly TCGCSV → Supabase price ingest. Trigger an immediate run below if you need fresher data before a quote."
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Cards in DB" value={coverage.totalCards.toLocaleString()} />
        <StatCard
          label="With live prices"
          value={`${coverage.withPrices.toLocaleString()}`}
          sub={`${coveragePct}% coverage`}
        />
        <StatCard label="Last successful run" value={fmtDateTime(coverage.lastSyncAt)} />
        <StatCard
          label="Source"
          value="TCGCSV"
          sub="TCGplayer market data"
        />
      </section>

      <section className="pop-card rounded-md p-4 flex flex-col gap-3">
        <Annotation>RUN NOW</Annotation>
        <TriggerSyncButton />
      </section>

      <section className="flex flex-col gap-2">
        <Annotation>RECENT RUNS</Annotation>
        <Table>
          <THead>
            <TR>
              <TH>Started</TH>
              <TH>Kind</TH>
              <TH>Status</TH>
              <TH className="text-right">Sets</TH>
              <TH className="text-right">Cards</TH>
              <TH className="text-right">Prices</TH>
              <TH>Duration</TH>
              <TH>Errors</TH>
            </TR>
          </THead>
          <TBody>
            {runs.length === 0 ? (
              <TR>
                <TD className="text-center text-secondary py-6">
                  No sync runs yet. Hit the button above to trigger one.
                </TD>
              </TR>
            ) : (
              runs.map((r) => (
                <TR key={r.id}>
                  <TD className="text-[11px] text-muted font-mono tabular-nums">
                    {fmtDateTime(r.started_at)}
                  </TD>
                  <TD>
                    <span className="font-display text-[11px] tracking-wider uppercase">
                      {r.kind}
                      {r.source ? ` · ${r.source}` : ""}
                    </span>
                  </TD>
                  <TD>
                    <span
                      className={`border-2 border-ink px-1.5 py-0.5 font-display text-[9px] tracking-wider rounded-sm ${STATUS_TONES[r.status] ?? "bg-paper-strong text-ink"}`}
                    >
                      {r.status.toUpperCase()}
                    </span>
                  </TD>
                  <TD className="text-right tabular-nums">{r.sets_processed}</TD>
                  <TD className="text-right tabular-nums">{r.cards_upserted}</TD>
                  <TD className="text-right tabular-nums">{r.prices_upserted}</TD>
                  <TD className="text-[11px] text-muted tabular-nums font-mono">
                    {fmtDuration(r.started_at, r.finished_at)}
                  </TD>
                  <TD className="text-[11px]">
                    {Array.isArray(r.errors) && r.errors.length > 0 ? (
                      <span
                        className="text-warn font-display tracking-wider"
                        title={JSON.stringify(r.errors.slice(0, 3))}
                      >
                        {r.errors.length} error
                        {r.errors.length === 1 ? "" : "s"}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </Table>
        {runs.length > 0 && runs[0].errors.length > 0 ? (
          <details className="pop-card rounded-md p-3">
            <summary className="cursor-pointer font-display text-[11px] tracking-wider">
              Latest run · first errors
            </summary>
            <ul className="mt-2 text-[12px] flex flex-col gap-1 max-h-[300px] overflow-auto">
              {runs[0].errors.slice(0, 20).map((e, i) => (
                <li key={i} className="font-mono text-[11px]">
                  <span className="text-muted">{e.group ?? "—"}</span> ·{" "}
                  {e.reason}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>
    </div>
  );
}

