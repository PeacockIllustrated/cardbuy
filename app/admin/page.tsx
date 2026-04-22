import Link from "next/link";
import { Annotation } from "@/components/wireframe/Annotation";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import {
  getAdminSubmissionStats,
  getAdminRecentActivity,
} from "@/app/_actions/admin";
import { MOCK_ORDERS, ORDER_STATUS_LABELS } from "@/lib/mock/mock-orders";
import {
  MOCK_LISTINGS,
  FEATURED_SLOT_COUNT,
  getFeaturedListings,
} from "@/lib/mock/mock-listings";
import { formatGBP } from "@/lib/mock/mock-offer";
import type { SubmissionStatus } from "@/lib/supabase/types";

const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
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

type ActivityRow = {
  when: string;
  kind: "submission" | "order";
  ref: string;
  who: string;
  status: string;
  amount: number;
  href: string;
};

export default async function AdminDashboardPage() {
  // ---- BUY-side (real, from Supabase) ----
  const [stats, submissionActivity] = await Promise.all([
    getAdminSubmissionStats(),
    getAdminRecentActivity(6),
  ]);

  // ---- SELL-side (still mock — lands in Phase 2b) ----
  const revenueGross = MOCK_ORDERS.filter((o) =>
    ["paid", "packing", "shipped", "delivered"].includes(o.status),
  ).reduce((s, o) => s + o.total_gbp, 0);
  const ordersToPack = MOCK_ORDERS.filter(
    (o) => o.status === "paid" || o.status === "packing",
  ).length;
  const activeListings = MOCK_LISTINGS.filter((l) => l.status === "active").length;
  const lowStock = MOCK_LISTINGS.filter(
    (l) => l.status === "active" && l.qty_in_stock <= 1,
  ).length;
  const featured = getFeaturedListings(FEATURED_SLOT_COUNT);

  // ---- Combined recent activity feed ----
  const activity: ActivityRow[] = [
    ...submissionActivity.map<ActivityRow>((s) => ({
      when: s.when,
      kind: "submission",
      ref: s.ref,
      who: s.who,
      status: SUBMISSION_STATUS_LABELS[s.status] ?? s.status,
      amount: s.amount,
      href: `/admin/submissions/${s.ref}`,
    })),
    ...MOCK_ORDERS.map<ActivityRow>((o) => ({
      when: o.placed_at,
      kind: "order",
      ref: o.reference,
      who: o.buyer_name,
      status: ORDER_STATUS_LABELS[o.status],
      amount: o.total_gbp,
      href: `/admin/orders?status=${o.status}`,
    })),
  ]
    .sort((a, b) => b.when.localeCompare(a.when))
    .slice(0, 8);

  return (
    <div className="px-4 py-6 max-w-[1400px] mx-auto flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <span className="font-display text-[10px] tracking-wider text-muted">
          Dashboard
        </span>
        <h1 className="font-display text-[32px] leading-none tracking-tight">
          Today at cardbuy
        </h1>
        <p className="text-secondary text-[13px]">
          Two sides of the business in one view.
        </p>
      </header>

      {/* Two-column stats: BUY vs SELL */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* BUY SIDE */}
        <div className="pop-card rounded-md p-4 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <span className="bg-yellow text-ink border-2 border-ink px-1.5 py-0.5 font-display text-[9px] tracking-wider rounded-sm">
              BUY · LIVE
            </span>
            <Annotation>buylist activity</Annotation>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Submissions / total" value={stats.total} />
            <Stat
              label="£ committed (open)"
              value={formatGBP(stats.committedGbp)}
            />
            <Stat label="Cards in queue" value={stats.cardsInQueue} />
            <Stat
              label="Awaiting cards"
              value={stats.awaitingCards}
              accent={stats.awaitingCards > 0 ? "warn" : undefined}
            />
          </div>
          <div className="flex gap-3 text-[11px] font-display tracking-wider">
            <Link
              href="/admin/submissions"
              className="underline underline-offset-4 decoration-2 hover:text-pink"
            >
              ALL SUBMISSIONS →
            </Link>
            <Link
              href="/admin/pricing"
              className="underline underline-offset-4 decoration-2 hover:text-pink"
            >
              MARGIN DIALS →
            </Link>
          </div>
        </div>

        {/* SELL SIDE */}
        <div className="pop-card rounded-md p-4 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <span className="bg-pink text-ink border-2 border-ink px-1.5 py-0.5 font-display text-[9px] tracking-wider rounded-sm">
              SELL · MOCK
            </span>
            <Annotation>shopfront activity</Annotation>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Revenue / week" value={formatGBP(revenueGross)} />
            <Stat label="Orders to pack" value={ordersToPack} />
            <Stat label="Active listings" value={activeListings} />
            <Stat
              label="Low-stock alerts"
              value={lowStock}
              accent={lowStock > 0 ? "warn" : undefined}
            />
          </div>
          <div className="flex gap-3 text-[11px] font-display tracking-wider">
            <Link
              href="/admin/orders"
              className="underline underline-offset-4 decoration-2 hover:text-pink"
            >
              ALL ORDERS →
            </Link>
            <Link
              href="/admin/inventory"
              className="underline underline-offset-4 decoration-2 hover:text-pink"
            >
              INVENTORY →
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURED slot manager (mock) */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <Annotation>
            FEATURED SLOTS · {featured.length} / {FEATURED_SLOT_COUNT} used (homepage)
          </Annotation>
          <Link
            href="/admin/inventory?tab=featured"
            className="text-[11px] font-display tracking-wider underline underline-offset-4 decoration-2 hover:text-pink"
          >
            Manage in inventory →
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: FEATURED_SLOT_COUNT }).map((_, i) => {
            const slot = featured[i];
            return (
              <div
                key={i}
                className={`rounded-md p-3 flex flex-col gap-1 min-h-[100px] justify-between ${
                  slot
                    ? "border-2 border-ink bg-paper-strong"
                    : "border-2 border-dashed border-ink/30 bg-paper"
                }`}
              >
                <div className="text-[10px] font-display uppercase tracking-wider text-muted tabular-nums">
                  Slot #{i + 1}
                </div>
                {slot ? (
                  <>
                    <div className="font-display text-[13px] leading-tight tracking-tight truncate">
                      {slot.card_name}
                    </div>
                    <div className="text-[11px] text-muted truncate tabular-nums">
                      {slot.variant === "raw"
                        ? `Raw · ${slot.condition}`
                        : `${slot.grading_company} ${slot.grade}`}{" "}
                      · {formatGBP(slot.price_gbp)}
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] text-muted italic font-display tracking-wider">
                    empty slot
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Combined activity feed */}
      <section className="flex flex-col gap-2">
        <Annotation>RECENT ACTIVITY</Annotation>
        <Table>
          <THead>
            <TR>
              <TH>When</TH>
              <TH>Kind</TH>
              <TH>Ref</TH>
              <TH>Who</TH>
              <TH>Status</TH>
              <TH className="text-right">Amount</TH>
            </TR>
          </THead>
          <TBody>
            {activity.length === 0 ? (
              <TR>
                <TD className="text-center text-secondary py-6">
                  No activity yet — waiting for your first submission.
                </TD>
              </TR>
            ) : (
              activity.map((a) => (
                <TR key={`${a.kind}-${a.ref}`}>
                  <TD className="text-muted text-[11px] font-mono tabular-nums">
                    {new Date(a.when).toISOString().slice(0, 16).replace("T", " ")}
                  </TD>
                  <TD>
                    <span
                      className={`border-2 border-ink px-1.5 py-0.5 font-display text-[9px] tracking-wider rounded-sm ${
                        a.kind === "submission"
                          ? "bg-yellow text-ink"
                          : "bg-pink text-ink"
                      }`}
                    >
                      {a.kind === "submission" ? "BUY" : "SELL"}
                    </span>
                  </TD>
                  <TD>
                    <Link
                      href={a.href}
                      className="font-mono text-[12px] underline underline-offset-4 decoration-2 hover:text-pink"
                    >
                      {a.ref}
                    </Link>
                  </TD>
                  <TD className="text-[13px]">{a.who}</TD>
                  <TD className="text-[12px] font-display tracking-wider uppercase">
                    {a.status}
                  </TD>
                  <TD className="text-right font-display tabular-nums">
                    {formatGBP(a.amount)}
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: "warn";
}) {
  return (
    <div className="border-2 border-ink rounded-md p-3 bg-paper-strong">
      <div className="text-[10px] font-display uppercase tracking-wider text-muted">
        {label}
      </div>
      <div
        className={`font-display text-[22px] leading-tight tracking-tight tabular-nums mt-1 ${
          accent === "warn" ? "text-warn" : "text-ink"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
