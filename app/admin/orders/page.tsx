import Link from "next/link";
import { Annotation } from "@/components/wireframe/Annotation";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { listAdminOrders } from "@/app/_actions/admin-shop";
import { formatGBP } from "@/lib/mock/mock-offer";
import type { ShopOrderStatus } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<ShopOrderStatus, string> = {
  pending_payment: "Pending payment",
  paid: "Paid",
  packing: "Packing",
  shipped: "Shipped",
  delivered: "Delivered",
  refunded: "Refunded",
  cancelled: "Cancelled",
};

const TABS: Array<{ key: ShopOrderStatus | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: "pending_payment", label: "Pending payment" },
  { key: "paid", label: "Paid" },
  { key: "packing", label: "Packing" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];

type SearchParams = Promise<{ status?: string }>;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const active = (sp.status as ShopOrderStatus | "all" | undefined) ?? "all";
  const rows = await listAdminOrders(active === "all" ? undefined : active);

  const allRows = active === "all" ? rows : await listAdminOrders("all");
  const revenue = allRows
    .filter((o) =>
      ["paid", "packing", "shipped", "delivered"].includes(o.status),
    )
    .reduce((s, o) => s + Number(o.total_gbp), 0);
  const pendingPaymentCount = allRows.filter(
    (o) => o.status === "pending_payment",
  ).length;
  const toPackCount = allRows.filter(
    (o) => o.status === "paid" || o.status === "packing",
  ).length;

  return (
    <div className="px-4 py-6 max-w-[1300px] mx-auto flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Annotation>ADMIN · ORDERS QUEUE</Annotation>
        <h1 className="font-display text-[26px] tracking-tight uppercase">
          Orders
        </h1>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBlock label="Orders total" value={allRows.length.toString()} />
        <StatBlock label="Revenue committed" value={formatGBP(revenue)} />
        <StatBlock
          label="Pending payment"
          value={pendingPaymentCount.toString()}
          tone={pendingPaymentCount > 0 ? "pink" : "paper"}
        />
        <StatBlock
          label="To pack"
          value={toPackCount.toString()}
          tone={toPackCount > 0 ? "teal" : "paper"}
        />
      </section>

      <nav className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const isActive = t.key === active;
          return (
            <Link
              key={t.key}
              href={
                t.key === "all" ? "/admin/orders" : `/admin/orders?status=${t.key}`
              }
              className={`pop-card rounded-sm px-2.5 py-1 font-display text-[11px] tracking-wider ${
                isActive
                  ? "bg-ink text-paper-strong border-ink"
                  : "bg-paper-strong text-secondary"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      {rows.length === 0 ? (
        <div className="pop-card rounded-md p-8 text-center text-secondary">
          No orders in this status yet.
        </div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Ref</TH>
              <TH>Buyer</TH>
              <TH>Items</TH>
              <TH className="text-right">Total</TH>
              <TH>Payment</TH>
              <TH>Shipping</TH>
              <TH>Status</TH>
              <TH>Placed</TH>
              <TH></TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((o) => (
              <TR key={o.id}>
                <TD className="font-mono text-[11px]">{o.reference}</TD>
                <TD>
                  <div className="text-[12px]">{o.buyer_name}</div>
                  <div className="text-[11px] text-muted">{o.buyer_email}</div>
                </TD>
                <TD className="tabular-nums">{o.item_count}</TD>
                <TD className="text-right tabular-nums font-display">
                  {formatGBP(Number(o.total_gbp))}
                </TD>
                <TD className="text-[11px]">
                  {o.payment_method === "stub" ? (
                    <span className="font-display tracking-wider text-pink">
                      STUB
                    </span>
                  ) : o.payment_method === "stripe_card" ? (
                    "Card"
                  ) : (
                    "PayPal"
                  )}
                </TD>
                <TD className="text-[11px]">
                  {o.shipping_method === "royal_mail_tracked"
                    ? "Tracked"
                    : "Special"}
                  {o.tracking_number ? (
                    <div className="text-[11px] text-muted">
                      {o.tracking_number}
                    </div>
                  ) : null}
                </TD>
                <TD>
                  <StatusBadge status={o.status}>
                    {STATUS_LABELS[o.status]}
                  </StatusBadge>
                </TD>
                <TD className="text-muted text-[11px] tabular-nums">
                  {new Date(o.placed_at)
                    .toISOString()
                    .slice(0, 16)
                    .replace("T", " ")}
                </TD>
                <TD>
                  <Link
                    href={`/admin/orders/${o.reference}`}
                    className="pop-block rounded-sm bg-paper-strong px-2 py-1 font-display text-[10px] tracking-wider text-ink"
                  >
                    Open →
                  </Link>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}

function StatBlock({
  label,
  value,
  tone = "paper",
}: {
  label: string;
  value: string;
  tone?: "paper" | "pink" | "teal";
}) {
  const bg =
    tone === "pink"
      ? "bg-pink"
      : tone === "teal"
        ? "bg-teal"
        : "bg-paper-strong";
  return (
    <div className={`pop-card rounded-md p-3 ${bg}`}>
      <div className="font-display text-[9px] tracking-[0.2em] text-ink/60 uppercase">
        {label}
      </div>
      <div className="font-display text-[22px] leading-none tabular-nums text-ink mt-1">
        {value}
      </div>
    </div>
  );
}

function StatusBadge({
  status,
  children,
}: {
  status: ShopOrderStatus;
  children: React.ReactNode;
}) {
  const tone: Record<ShopOrderStatus, string> = {
    pending_payment: "bg-pink",
    paid: "bg-yellow",
    packing: "bg-yellow",
    shipped: "bg-teal",
    delivered: "bg-teal",
    refunded: "bg-paper",
    cancelled: "bg-paper",
  };
  const textColor =
    status === "cancelled" || status === "refunded"
      ? "text-muted"
      : "text-ink";
  return (
    <span
      className={`border-2 border-ink rounded-sm px-1.5 py-0.5 font-display text-[10px] tracking-wider ${tone[status]} ${textColor}`}
    >
      {children}
    </span>
  );
}
