import Link from "next/link";
import { notFound } from "next/navigation";
import { Annotation } from "@/components/wireframe/Annotation";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { getAdminOrder } from "@/app/_actions/admin-shop";
import { formatGBP } from "@/lib/mock/mock-offer";
import { OrderStatusControls } from "./OrderStatusControls";
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

type Params = Promise<{ ref: string }>;

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Params;
}) {
  const { ref } = await params;
  const result = await getAdminOrder(ref);
  if (!result) notFound();
  const { order, items, buyer } = result;

  return (
    <div className="px-4 py-6 max-w-[1100px] mx-auto flex flex-col gap-6">
      <nav className="text-[12px] font-display tracking-wider text-muted">
        <Link href="/admin/orders" className="hover:text-pink">
          ← Orders
        </Link>
      </nav>

      <header className="flex flex-col gap-2">
        <Annotation>ADMIN · ORDER</Annotation>
        <h1 className="font-display text-[28px] tracking-tight break-all">
          {order.reference}
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-display text-[11px] tracking-wider border-2 border-ink rounded-sm px-2 py-0.5 bg-paper-strong">
            {STATUS_LABELS[order.status]}
          </span>
          {order.payment_method === "stub" ? (
            <span className="font-display text-[10px] tracking-wider border-2 border-ink rounded-sm px-2 py-0.5 bg-pink">
              STUB PAYMENT
            </span>
          ) : null}
          {order.add_to_binder_opt_in ? (
            <span className="font-display text-[10px] tracking-wider border-2 border-ink rounded-sm px-2 py-0.5 bg-teal">
              BINDER OPT-IN
            </span>
          ) : null}
        </div>
      </header>

      <OrderStatusControls
        orderId={order.id}
        currentStatus={order.status}
        currentTracking={order.tracking_number}
        addToBinderOptIn={order.add_to_binder_opt_in}
        binderEntriesCreatedAt={order.binder_entries_created_at}
      />

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="pop-card rounded-md p-4 flex flex-col gap-2">
          <Annotation>BUYER</Annotation>
          <div className="text-[13px]">{order.buyer_name}</div>
          <div className="text-[11px] text-muted">{order.buyer_email}</div>
          {buyer ? (
            <Link
              href={`/admin/users#${buyer.id}`}
              className="text-[11px] font-display tracking-wider text-pink underline underline-offset-2 decoration-2 self-start"
            >
              Open buyer profile →
            </Link>
          ) : (
            <div className="text-[11px] text-muted">
              (buyer deleted their account — snapshot retained)
            </div>
          )}
        </div>

        <div className="pop-card rounded-md p-4 flex flex-col gap-2">
          <Annotation>SHIP TO</Annotation>
          <address className="not-italic text-[13px] leading-[1.6]">
            {order.shipping_address.line1}
            {order.shipping_address.line2 ? (
              <>
                <br />
                {order.shipping_address.line2}
              </>
            ) : null}
            <br />
            {order.shipping_address.city}
            <br />
            {order.shipping_address.postcode}
            <br />
            {order.shipping_address.country}
          </address>
          <div className="text-[11px] text-muted">
            {order.shipping_method === "royal_mail_tracked"
              ? "Royal Mail Tracked"
              : "Royal Mail Special Delivery"}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <Annotation>ITEMS</Annotation>
        <Table>
          <THead>
            <TR>
              <TH>Card</TH>
              <TH>Variant</TH>
              <TH>Qty</TH>
              <TH className="text-right">Unit</TH>
              <TH className="text-right">Line</TH>
            </TR>
          </THead>
          <TBody>
            {items.map((i) => (
              <TR key={i.id}>
                <TD>
                  <div className="text-[13px]">{i.card_name}</div>
                  <div className="text-[11px] text-muted">{i.set_name}</div>
                </TD>
                <TD className="text-[11px]">
                  {i.variant === "raw"
                    ? `Raw · ${i.condition}`
                    : `${i.grading_company} ${i.grade}`}
                </TD>
                <TD className="tabular-nums">{i.qty}</TD>
                <TD className="text-right tabular-nums">
                  {formatGBP(Number(i.unit_price_gbp))}
                </TD>
                <TD className="text-right tabular-nums">
                  {formatGBP(Number(i.line_total_gbp))}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <div className="flex flex-col items-end gap-1 text-[13px] tabular-nums">
          <div className="flex gap-8">
            <span className="text-secondary">Subtotal</span>
            <span>{formatGBP(Number(order.subtotal_gbp))}</span>
          </div>
          <div className="flex gap-8">
            <span className="text-secondary">Shipping</span>
            <span>
              {Number(order.shipping_gbp) === 0
                ? "Free"
                : formatGBP(Number(order.shipping_gbp))}
            </span>
          </div>
          <div className="flex gap-8 text-[16px] mt-1">
            <span className="text-secondary uppercase tracking-wider text-[11px] self-end">
              Total
            </span>
            <span className="font-display">
              {formatGBP(Number(order.total_gbp))}
            </span>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[11px] text-muted">
        <Meta label="Placed" value={fmtDate(order.placed_at)} />
        <Meta label="Paid" value={fmtDate(order.paid_at)} />
        <Meta label="Shipped" value={fmtDate(order.shipped_at)} />
        <Meta label="Delivered" value={fmtDate(order.delivered_at)} />
        <Meta label="Cancelled" value={fmtDate(order.cancelled_at)} />
        <Meta
          label="Binder auto-add"
          value={fmtDate(order.binder_entries_created_at)}
        />
      </section>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="pop-card rounded-sm bg-paper-strong p-2">
      <div className="font-display text-[9px] tracking-[0.2em] text-ink/60 uppercase">
        {label}
      </div>
      <div className="tabular-nums text-ink">{value}</div>
    </div>
  );
}

function fmtDate(v: string | null): string {
  if (!v) return "—";
  return new Date(v).toISOString().slice(0, 16).replace("T", " ");
}
