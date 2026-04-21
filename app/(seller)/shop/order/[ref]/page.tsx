import Link from "next/link";
import { notFound } from "next/navigation";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { getOrderByReference } from "@/app/_actions/shop";
import { formatGBP } from "@/lib/mock/mock-offer";
import { PaymentsComingSoonModal } from "./PaymentsComingSoonModal";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  pending_payment: "Awaiting payment",
  paid: "Payment received",
  packing: "Packing",
  shipped: "Shipped",
  delivered: "Delivered",
  refunded: "Refunded",
  cancelled: "Cancelled",
};

type Params = Promise<{ ref: string }>;
type SearchParams = Promise<{ just_placed?: string }>;

export default async function OrderConfirmationPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { ref } = await params;
  const sp = await searchParams;

  const result = await getOrderByReference(ref);
  if (!result) notFound();
  const { order, items } = result;

  const justPlaced = sp.just_placed === "1";
  const showStubPaymentModal =
    justPlaced &&
    order.status === "pending_payment" &&
    order.payment_method === "stub";

  return (
    <div className="max-w-[900px] mx-auto px-4 py-10 flex flex-col gap-8">
      {showStubPaymentModal ? (
        <PaymentsComingSoonModal
          reference={order.reference}
          buyerEmail={order.buyer_email}
        />
      ) : null}

      <header
        className={`pop-block rounded-lg p-6 flex flex-col gap-3 ${
          order.status === "cancelled"
            ? "bg-warn/20"
            : order.status === "delivered"
              ? "bg-teal"
              : "bg-yellow"
        }`}
      >
        <span className="bg-ink text-paper-strong w-fit px-2 py-1 font-display text-[10px] tracking-wider">
          {order.payment_method === "stub" && order.status === "pending_payment"
            ? "Order received"
            : "Order confirmed"}
        </span>
        <h1 className="font-display text-[32px] md:text-[40px] leading-[0.95] tracking-tight break-all">
          {order.reference}
        </h1>
        <p className="text-[14px]">
          Status:{" "}
          <strong className="font-display tracking-wider">
            {STATUS_LABELS[order.status] ?? order.status}
          </strong>
          {order.payment_method === "stub" &&
          order.status === "pending_payment"
            ? " · payments coming soon"
            : "."}{" "}
          Confirmation sent to <strong>{order.buyer_email}</strong>.
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
            {items.map((it) => (
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
                <TD className="text-right">
                  {formatGBP(Number(it.unit_price_gbp))}
                </TD>
                <TD className="text-right">
                  {formatGBP(Number(it.line_total_gbp))}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <div className="flex flex-col items-end gap-1 text-[13px]">
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
            <span>{formatGBP(Number(order.total_gbp))}</span>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="pop-card rounded-md p-4 flex flex-col gap-2">
          <span className="font-display text-[11px] tracking-wider">
            Shipping to
          </span>
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
            {order.tracking_number ? (
              <>
                {" "}
                · tracking <strong>{order.tracking_number}</strong>
              </>
            ) : null}
          </div>
        </div>

        <div className="pop-card bg-pink/15 rounded-md p-4 flex flex-col gap-3">
          <span className="font-display text-[11px] tracking-wider">
            What happens next
          </span>
          <ol className="flex flex-col gap-2 text-[13px] list-decimal pl-5">
            <li>Lewis reviews your order.</li>
            <li>We confirm payment (Stripe coming soon — manual for now).</li>
            <li>Lewis pulls and packs your cards (sleeved + toploadered).</li>
            <li>We dispatch and email a tracking number.</li>
            <li>
              Royal Mail delivers — usually within 2 working days after
              dispatch.
            </li>
          </ol>
          {order.add_to_binder_opt_in ? (
            <p className="text-[11px] text-teal font-display tracking-wider">
              ✓ We&rsquo;ll add these to your binder when they arrive.
            </p>
          ) : null}
        </div>
      </section>

      <footer className="text-[12px] text-muted">
        Questions? Email <span className="underline">[support@cardbuy.tbc]</span>{" "}
        and quote {order.reference}.{" "}
        <Link href="/shop" className="underline">
          Continue shopping →
        </Link>
      </footer>
    </div>
  );
}
