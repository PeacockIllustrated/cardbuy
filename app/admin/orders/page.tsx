import Link from "next/link";
import { Annotation } from "@/components/wireframe/Annotation";
import { TodoMarker } from "@/components/wireframe/TodoMarker";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { Button } from "@/components/ui/Form";
import { MOCK_ORDERS, ORDER_STATUS_LABELS } from "@/lib/mock/mock-orders";
import type { OrderStatus } from "@/lib/mock/types";
import { formatGBP } from "@/lib/mock/mock-offer";

const TABS: Array<{ key: OrderStatus | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: "pending_payment", label: "Pending payment" },
  { key: "paid", label: "Paid" },
  { key: "packing", label: "Packing" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "refunded", label: "Refunded" },
];

type SearchParams = Promise<{ status?: string }>;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const active = (sp.status as OrderStatus | "all" | undefined) ?? "all";
  const rows =
    active === "all" ? MOCK_ORDERS : MOCK_ORDERS.filter((o) => o.status === active);

  const revenue = MOCK_ORDERS.filter((o) =>
    ["paid", "packing", "shipped", "delivered"].includes(o.status)
  ).reduce((s, o) => s + o.total_gbp, 0);

  return (
    <div className="px-4 py-6 max-w-[1300px] mx-auto flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Annotation>ADMIN · ORDERS QUEUE</Annotation>
        <h1 className="text-[22px] font-mono">Orders</h1>
      </header>

      {/* Stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="border border-ink p-3">
          <div className="text-[11px] uppercase tracking-wider text-secondary">[Orders / week]</div>
          <div className="text-[22px]">{MOCK_ORDERS.length}</div>
        </div>
        <div className="border border-ink p-3">
          <div className="text-[11px] uppercase tracking-wider text-secondary">[Revenue committed]</div>
          <div className="text-[22px]">{formatGBP(revenue)}</div>
        </div>
        <div className="border border-ink p-3">
          <div className="text-[11px] uppercase tracking-wider text-secondary">[Awaiting payment]</div>
          <div className="text-[22px]">
            {MOCK_ORDERS.filter((o) => o.status === "pending_payment").length}
          </div>
        </div>
        <div className="border border-ink p-3">
          <div className="text-[11px] uppercase tracking-wider text-secondary">[To pack]</div>
          <div className="text-[22px]">
            {MOCK_ORDERS.filter((o) => o.status === "paid" || o.status === "packing").length}
          </div>
        </div>
      </section>

      <nav className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const isActive = t.key === active;
          return (
            <Link
              key={t.key}
              href={t.key === "all" ? "/admin/orders" : `/admin/orders?status=${t.key}`}
              className={`border px-2 py-1 text-[12px] uppercase tracking-wider ${
                isActive ? "border-ink bg-ink text-paper" : "border-rule text-secondary"
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
          {rows.length === 0 ? (
            <TR>
              <TD className="text-center text-secondary py-6">
                No orders in this status.
              </TD>
            </TR>
          ) : (
            rows.map((o) => (
              <TR key={o.id}>
                <TD className="font-mono">{o.reference}</TD>
                <TD>
                  {o.buyer_name}
                  <div className="text-[11px] text-muted">{o.buyer_email}</div>
                </TD>
                <TD>{o.items.reduce((n, i) => n + i.qty, 0)}</TD>
                <TD className="text-right">{formatGBP(o.total_gbp)}</TD>
                <TD className="text-[12px]">
                  {o.payment_method === "stripe_card" ? "Card" : "PayPal"}
                </TD>
                <TD className="text-[12px]">
                  {o.shipping_method === "royal_mail_tracked" ? "Tracked" : "Special"}
                  {o.tracking_number ? (
                    <div className="text-[11px] text-muted">{o.tracking_number}</div>
                  ) : null}
                </TD>
                <TD>{ORDER_STATUS_LABELS[o.status]}</TD>
                <TD className="text-muted text-[11px]">
                  {new Date(o.placed_at).toISOString().slice(0, 16).replace("T", " ")}
                </TD>
                <TD>
                  <Button size="sm" variant="secondary" disabled>Open →</Button>
                </TD>
              </TR>
            ))
          )}
        </TBody>
      </Table>

      <TodoMarker phase={2}>order detail page (/admin/orders/[ref])</TodoMarker>
    </div>
  );
}
