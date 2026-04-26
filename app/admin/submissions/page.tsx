import Link from "next/link";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { Button } from "@/components/ui/Form";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { listAdminSubmissions } from "@/app/_actions/admin";
import type { SubmissionStatus } from "@/lib/supabase/types";
import { formatGBP } from "@/lib/mock/mock-offer";

const STATUS_LABELS: Record<SubmissionStatus, string> = {
  draft: "Draft",
  submitted: "Awaiting cards",
  awaiting_cards: "Awaiting cards",
  received: "Received",
  under_review: "Under review",
  offer_revised: "Offered",
  approved: "Approved",
  paid: "Paid",
  rejected: "Rejected",
  returned: "Returned",
  cancelled: "Cancelled",
};

const STATUS_TONES: Partial<
  Record<SubmissionStatus, "pink" | "teal" | "yellow" | "warn" | "muted">
> = {
  submitted: "yellow",
  awaiting_cards: "yellow",
  received: "teal",
  under_review: "teal",
  offer_revised: "pink",
  approved: "teal",
  paid: "teal",
  rejected: "warn",
  returned: "muted",
  cancelled: "muted",
};

const TABS: Array<{ key: SubmissionStatus | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: "submitted", label: "Awaiting cards" },
  { key: "received", label: "Received" },
  { key: "under_review", label: "Under review" },
  { key: "offer_revised", label: "Offered" },
  { key: "paid", label: "Paid" },
  { key: "rejected", label: "Rejected" },
];

type SearchParams = Promise<{ status?: string }>;

export default async function AdminSubmissionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const active = (sp.status as SubmissionStatus | "all" | undefined) ?? "all";
  const rows = await listAdminSubmissions(
    active === "all" ? undefined : active,
  );

  const totalCount = rows.length;
  return (
    <div className="px-4 md:px-6 py-6 max-w-[1300px] mx-auto flex flex-col gap-6">
      <AdminPageHeader
        crumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Buy side" },
          { label: "Submissions" },
        ]}
        title="Submissions"
        kicker={{
          label: active === "all" ? "ALL" : (STATUS_LABELS[active as SubmissionStatus] ?? String(active)).toUpperCase(),
          tone: "yellow",
        }}
        subtitle="Incoming buylist packages — track status, quote, pay out."
        actions={
          <span className="font-display text-[11px] tracking-wider tabular-nums text-muted">
            {totalCount} in view
          </span>
        }
      />

      <nav className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const isActive = t.key === active;
          return (
            <Link
              key={t.key}
              href={
                t.key === "all"
                  ? "/admin/submissions"
                  : `/admin/submissions?status=${t.key}`
              }
              className={`border-2 rounded-sm px-2.5 py-1 font-display text-[11px] tracking-wider uppercase transition-colors ${
                isActive
                  ? "border-ink bg-ink text-paper-strong"
                  : "border-ink bg-paper-strong text-ink hover:bg-yellow"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      <Table>
        <THead>
          <TR>
            <TH>Ref</TH>
            <TH>Seller</TH>
            <TH>Cards</TH>
            <TH className="text-right">Committed</TH>
            <TH>Status</TH>
            <TH>Submitted</TH>
            <TH></TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <TR>
              <TD className="text-center text-secondary py-6">
                No submissions in this status.
              </TD>
            </TR>
          ) : (
            rows.map((s) => {
              const tone = STATUS_TONES[s.status];
              const toneCls =
                tone === "pink"
                  ? "bg-pink text-ink"
                  : tone === "teal"
                    ? "bg-teal text-ink"
                    : tone === "yellow"
                      ? "bg-yellow text-ink"
                      : tone === "warn"
                        ? "bg-warn text-paper-strong"
                        : "bg-paper-strong text-muted";
              return (
                <TR key={s.id}>
                  <TD className="font-mono text-[12px] tabular-nums">
                    {s.reference}
                  </TD>
                  <TD>
                    <div className="font-display text-[13px] tracking-tight">
                      {s.seller_name ?? "—"}
                    </div>
                    <div className="text-[11px] text-muted">
                      {s.seller_email}
                    </div>
                  </TD>
                  <TD className="tabular-nums">{s.item_count}</TD>
                  <TD className="text-right tabular-nums font-display">
                    {formatGBP(Number(s.total_offered ?? 0))}
                  </TD>
                  <TD>
                    <span
                      className={`border-2 border-ink px-1.5 py-0.5 font-display text-[9px] tracking-wider rounded-sm ${toneCls}`}
                    >
                      {STATUS_LABELS[s.status]}
                    </span>
                  </TD>
                  <TD className="text-muted text-[11px] tabular-nums font-mono">
                    {(s.submitted_at ?? s.created_at).slice(0, 10)}
                  </TD>
                  <TD>
                    <Link href={`/admin/submissions/${s.reference}`}>
                      <Button size="sm" variant="secondary">
                        Open →
                      </Button>
                    </Link>
                  </TD>
                </TR>
              );
            })
          )}
        </TBody>
      </Table>

      <p className="text-[11px] text-muted font-display tracking-wider">
        Live data · pulled from{" "}
        <code className="font-mono">lewis_submissions</code> via RLS-scoped
        admin read.
      </p>
    </div>
  );
}
