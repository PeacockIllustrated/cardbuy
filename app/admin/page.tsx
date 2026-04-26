import Link from "next/link";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { SectionCard } from "@/components/admin/SectionCard";
import { StatCard } from "@/components/admin/StatCard";
import {
  getAdminSubmissionStats,
  getAdminRecentActivity,
} from "@/app/_actions/admin";
import { listAdminOrders } from "@/app/_actions/admin-shop";
import {
  MOCK_LISTINGS,
  FEATURED_SLOT_COUNT,
  getFeaturedListings,
} from "@/lib/mock/mock-listings";
import { formatGBP } from "@/lib/mock/mock-offer";
import type { SubmissionStatus, ShopOrderStatus } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

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

const ORDER_STATUS_LABELS: Record<ShopOrderStatus, string> = {
  pending_payment: "Pending payment",
  paid: "Paid",
  packing: "Packing",
  shipped: "Shipped",
  delivered: "Delivered",
  refunded: "Refunded",
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
  const [stats, submissionActivity, orders] = await Promise.all([
    getAdminSubmissionStats(),
    getAdminRecentActivity(6),
    listAdminOrders("all"),
  ]);

  const revenueGross = orders
    .filter((o) => ["paid", "packing", "shipped", "delivered"].includes(o.status))
    .reduce((s, o) => s + Number(o.total_gbp), 0);
  const ordersToPack = orders.filter(
    (o) => o.status === "paid" || o.status === "packing",
  ).length;
  const pendingPayment = orders.filter(
    (o) => o.status === "pending_payment",
  ).length;
  const activeListings = MOCK_LISTINGS.filter((l) => l.status === "active").length;
  const lowStock = MOCK_LISTINGS.filter(
    (l) => l.status === "active" && l.qty_in_stock <= 1,
  ).length;
  const featured = getFeaturedListings(FEATURED_SLOT_COUNT);
  const emptyFeaturedSlots = FEATURED_SLOT_COUNT - featured.length;

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
    ...orders.slice(0, 8).map<ActivityRow>((o) => ({
      when: o.placed_at,
      kind: "order",
      ref: o.reference,
      who: o.buyer_name,
      status: ORDER_STATUS_LABELS[o.status],
      amount: Number(o.total_gbp),
      href: `/admin/orders/${o.reference}`,
    })),
  ]
    .sort((a, b) => b.when.localeCompare(a.when))
    .slice(0, 10);

  const actionQueue = buildActionQueue({
    awaitingCards: stats.awaitingCards,
    received: stats.received,
    offerRevised: stats.offerRevised,
    pendingPayment,
    ordersToPack,
    lowStock,
    emptyFeaturedSlots,
  });

  return (
    <div className="px-4 md:px-6 py-6 max-w-[1400px] mx-auto flex flex-col gap-6">
      <AdminPageHeader
        crumbs={[{ label: "Admin", href: "/admin" }, { label: "Dashboard" }]}
        title="Today at cardbuy"
        kicker={{ label: "LIVE", tone: "teal" }}
        subtitle="The two sides of the business in one glance — buy queue, sell queue, and what needs your attention now."
      />

      {/* ─── Action queue ─── */}
      <SectionCard
        eyebrow="Needs your attention"
        title="Action queue"
        actions={
          <span className="font-display text-[11px] tracking-wider tabular-nums text-muted">
            {actionQueue.length} open
          </span>
        }
      >
        {actionQueue.length === 0 ? (
          <div className="border-2 border-dashed border-ink/25 rounded-md p-5 text-center text-secondary text-[13px]">
            All clear. Nothing needs your attention right now.
          </div>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {actionQueue.map((item) => (
              <li key={item.title}>
                <Link
                  href={item.href}
                  className={`pop-block rounded-md p-3 flex items-center gap-3 ${item.bg}`}
                >
                  <span
                    className="font-display text-[28px] leading-none tabular-nums text-ink min-w-[44px] text-center"
                    aria-hidden
                  >
                    {item.count}
                  </span>
                  <span className="flex-1">
                    <span className="font-display text-[12px] tracking-wider uppercase text-ink block">
                      {item.title}
                    </span>
                    <span className="text-[11px] text-ink/70 block">
                      {item.cta}
                    </span>
                  </span>
                  <span
                    className="font-display text-[13px] text-ink shrink-0"
                    aria-hidden
                  >
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* ─── Two-column KPIs: buy vs sell ─── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard
          eyebrow="Buy side"
          title="Buylist"
          actions={
            <span className="border-2 border-ink bg-yellow px-1.5 py-0.5 font-display text-[9px] tracking-wider rounded-sm">
              LIVE
            </span>
          }
        >
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Open submissions"
              value={stats.total - stats.paid - stats.rejected}
              sub={`${stats.total} total`}
              href="/admin/submissions"
            />
            <StatCard
              label="£ committed"
              value={formatGBP(stats.committedGbp)}
              sub="Across open submissions"
            />
            <StatCard
              label="Cards in queue"
              value={stats.cardsInQueue}
              sub="Received · reviewing · offered"
            />
            <StatCard
              label="Awaiting cards"
              value={stats.awaitingCards}
              tone={stats.awaitingCards > 0 ? "yellow" : "paper"}
              sub={stats.awaitingCards > 0 ? "Posted but not received" : "None"}
              href="/admin/submissions?status=submitted"
            />
          </div>
          <div className="flex gap-3 pt-3 text-[11px] font-display tracking-wider">
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
        </SectionCard>

        <SectionCard
          eyebrow="Sell side"
          title="Shopfront"
          actions={
            <span className="border-2 border-ink bg-pink px-1.5 py-0.5 font-display text-[9px] tracking-wider rounded-sm">
              LIVE
            </span>
          }
        >
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Revenue committed"
              value={formatGBP(revenueGross)}
              sub="Paid through delivered"
            />
            <StatCard
              label="Orders to pack"
              value={ordersToPack}
              tone={ordersToPack > 0 ? "pink" : "paper"}
              href="/admin/orders?status=paid"
              sub={ordersToPack > 0 ? "Needs shipping label" : "None"}
            />
            <StatCard
              label="Active listings"
              value={activeListings}
              sub={`${MOCK_LISTINGS.length} total stocked`}
              href="/admin/inventory"
            />
            <StatCard
              label="Low-stock alerts"
              value={lowStock}
              tone={lowStock > 0 ? "warn" : "paper"}
              sub={lowStock > 0 ? "1 or fewer in stock" : "Healthy"}
              href="/admin/inventory"
            />
          </div>
          <div className="flex gap-3 pt-3 text-[11px] font-display tracking-wider">
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
            <Link
              href="/admin/demand"
              className="underline underline-offset-4 decoration-2 hover:text-pink"
            >
              DEMAND →
            </Link>
          </div>
        </SectionCard>
      </section>

      {/* ─── Featured slot manager ─── */}
      <SectionCard
        eyebrow={`Featured on homepage · ${featured.length} / ${FEATURED_SLOT_COUNT} used`}
        title="Featured slots"
        actions={
          <Link
            href="/admin/inventory?tab=featured"
            className="font-display text-[11px] tracking-wider underline underline-offset-4 decoration-2 hover:text-pink"
          >
            Manage in inventory →
          </Link>
        }
      >
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
      </SectionCard>

      {/* ─── Activity feed ─── */}
      <SectionCard
        eyebrow="Recent activity"
        title="Across both sides"
        padded={false}
      >
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
      </SectionCard>
    </div>
  );
}

type Action = {
  title: string;
  count: number;
  cta: string;
  href: string;
  bg: string;
};

function buildActionQueue(input: {
  awaitingCards: number;
  received: number;
  offerRevised: number;
  pendingPayment: number;
  ordersToPack: number;
  lowStock: number;
  emptyFeaturedSlots: number;
}): Action[] {
  const items: Action[] = [];
  if (input.received > 0) {
    items.push({
      title: "Received · review & quote",
      count: input.received,
      cta: "Post arrived, need quoting",
      href: "/admin/submissions?status=received",
      bg: "bg-yellow",
    });
  }
  if (input.offerRevised > 0) {
    items.push({
      title: "Offers out · awaiting seller",
      count: input.offerRevised,
      cta: "Waiting for accept / reject",
      href: "/admin/submissions?status=offer_revised",
      bg: "bg-paper-strong",
    });
  }
  if (input.awaitingCards > 0) {
    items.push({
      title: "Awaiting cards in post",
      count: input.awaitingCards,
      cta: "Seller has shipped (or should have)",
      href: "/admin/submissions?status=submitted",
      bg: "bg-paper-strong",
    });
  }
  if (input.pendingPayment > 0) {
    items.push({
      title: "Orders pending payment",
      count: input.pendingPayment,
      cta: "Buyer hasn't paid yet",
      href: "/admin/orders?status=pending_payment",
      bg: "bg-pink",
    });
  }
  if (input.ordersToPack > 0) {
    items.push({
      title: "Orders to pack & ship",
      count: input.ordersToPack,
      cta: "Paid — print label and send",
      href: "/admin/orders?status=paid",
      bg: "bg-pink",
    });
  }
  if (input.lowStock > 0) {
    items.push({
      title: "Listings low on stock",
      count: input.lowStock,
      cta: "One or fewer remaining",
      href: "/admin/inventory",
      bg: "bg-teal",
    });
  }
  if (input.emptyFeaturedSlots > 0) {
    items.push({
      title: "Empty featured slots",
      count: input.emptyFeaturedSlots,
      cta: "Homepage promo slots unused",
      href: "/admin/inventory?tab=featured",
      bg: "bg-teal",
    });
  }
  return items;
}
