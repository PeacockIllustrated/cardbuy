import Link from "next/link";
import { TodoMarker } from "@/components/wireframe/TodoMarker";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { MOCK_ORDERS, ORDER_STATUS_LABELS } from "@/lib/mock/mock-orders";
import { formatGBP } from "@/lib/mock/mock-offer";

type Params = Promise<{ ref: string }>;

const FALLBACK = MOCK_ORDERS[0];

export default async function OrderConfirmationPage({
  params,
}: {
  params: Params;
}) {
  const { ref } = await params;
  // For Phase 1, render either the real mock match or a synthetic stub from the URL.
  const order = MOCK_ORDERS.find((o) => o.reference === ref) ?? {
    ...FALLBACK,
    reference: ref,
    status: "pending_payment" as const,
  };

  return (
    <div className="max-w-[900px] mx-auto px-4 py-10 flex flex-col gap-8">
      <header className="pop-block bg-teal rounded-lg p-6 flex flex-col gap-3">
        <span className="bg-ink text-paper-strong w-fit px-2 py-1 font-display text-[10px] tracking-wider">
          Order confirmed
        </span>
        <h1 className="font-display text-[32px] md:text-[40px] leading-[0.95] tracking-tight break-all">
          {order.reference}
        </h1>
        <p className="text-[14px]">
          Thanks for your order. Status:{" "}
          <strong className="font-display tracking-wider">
            {ORDER_STATUS_LABELS[order.status]}
          </strong>
          . We&apos;ve emailed a copy of this confirmation to{" "}
          <strong>{order.buyer_email}</strong>.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-[16px] tracking-wider">Order items</h2>
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
            {order.items.map((it) => (
              <TR key={it.id}>
                <TD>
                  <div className="text-[13px]">{it.card_name}</div>
                  <div className="text-[11px] text-muted">{it.set_name}</div>
                </TD>
                <TD>
                  {it.variant === "raw"
                    ? `Raw · ${it.condition}`
                    : `Graded · ${it.grading_company} ${it.grade}`}
                </TD>
                <TD>{it.qty}</TD>
                <TD className="text-right">{formatGBP(it.unit_price_gbp)}</TD>
                <TD className="text-right">{formatGBP(it.line_total_gbp)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <div className="flex flex-col items-end gap-1 text-[13px]">
          <div className="flex gap-8">
            <span className="text-secondary">Subtotal</span>
            <span>{formatGBP(order.subtotal_gbp)}</span>
          </div>
          <div className="flex gap-8">
            <span className="text-secondary">Shipping</span>
            <span>{order.shipping_gbp === 0 ? "Free" : formatGBP(order.shipping_gbp)}</span>
          </div>
          <div className="flex gap-8 text-[16px] mt-1">
            <span className="text-secondary uppercase tracking-wider text-[11px] self-end">
              Total
            </span>
            <span>{formatGBP(order.total_gbp)}</span>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="pop-card rounded-md p-4 flex flex-col gap-2">
          <span className="font-display text-[11px] tracking-wider">Shipping to</span>
          <address className="not-italic text-[13px] leading-[1.6]">
            {order.buyer_name}
            <br />
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
          <div className="text-[11px] text-muted mt-1">
            {order.shipping_method === "royal_mail_tracked"
              ? "Royal Mail Tracked"
              : "Royal Mail Special Delivery"}
            {order.tracking_number ? <> · tracking <strong>{order.tracking_number}</strong></> : null}
          </div>
        </div>

        <div className="pop-card bg-pink/15 rounded-md p-4 flex flex-col gap-3">
          <span className="font-display text-[11px] tracking-wider">What happens next</span>
          <ol className="flex flex-col gap-2 text-[13px] list-decimal pl-5">
            <li>We confirm your payment.</li>
            <li>Lewis pulls and packs your cards (sleeved + toploadered).</li>
            <li>We dispatch and email a tracking number.</li>
            <li>Royal Mail delivers — usually within 2 working days.</li>
          </ol>
          <TodoMarker phase={4}>real tracking webhook</TodoMarker>
        </div>
      </section>

      <footer className="text-[12px] text-muted">
        Questions? Email <span className="underline">[support@cardbuy.tbc]</span> and quote {order.reference}.{" "}
        <Link href="/shop" className="underline">Continue shopping →</Link>
      </footer>
    </div>
  );
}
