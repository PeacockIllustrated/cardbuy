import Link from "next/link";
import { Annotation } from "@/components/wireframe/Annotation";
import { TodoMarker } from "@/components/wireframe/TodoMarker";
import { Button, Field, Input, Select } from "@/components/ui/Form";
import { MOCK_LISTINGS } from "@/lib/mock/mock-listings";
import { formatGBP } from "@/lib/mock/mock-offer";

const SAMPLE = [
  { listing: MOCK_LISTINGS.find((l) => l.id === "lst-004")!, qty: 1 },
  { listing: MOCK_LISTINGS.find((l) => l.id === "lst-006")!, qty: 1 },
  { listing: MOCK_LISTINGS.find((l) => l.id === "lst-007")!, qty: 2 },
];

export default function ShopCheckoutPage() {
  const subtotal = SAMPLE.reduce(
    (s, { listing, qty }) => s + listing.price_gbp * qty,
    0
  );
  const shipping = subtotal >= 250 ? 0 : 3.5;
  const total = subtotal + shipping;
  const itemCount = SAMPLE.reduce((s, { qty }) => s + qty, 0);

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-8 flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <span className="bg-pink text-ink border-2 border-ink w-fit px-2 py-1 font-display text-[10px] tracking-wider">
          Buying from us
        </span>
        <h1 className="font-display text-[32px] leading-none tracking-tight">
          Checkout
        </h1>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6 items-start">
        <form
          action="/shop/order/CB-ORD-2026-000018"
          className="flex flex-col gap-6 pop-card rounded-md p-5"
        >
          <section className="flex flex-col gap-3">
            <Annotation>BUYER DETAILS</Annotation>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Full name"><Input name="name" required /></Field>
              <Field label="Email"><Input name="email" type="email" required /></Field>
              <Field label="Phone (optional)"><Input name="phone" type="tel" /></Field>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <Annotation>SHIPPING ADDRESS</Annotation>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Address line 1" className="md:col-span-2">
                <Input name="line1" required />
              </Field>
              <Field label="Address line 2 (optional)" className="md:col-span-2">
                <Input name="line2" />
              </Field>
              <Field label="Town / city"><Input name="city" required /></Field>
              <Field label="Postcode"><Input name="postcode" required /></Field>
              <Field label="Country">
                <Select name="country" defaultValue="GB">
                  <option value="GB">United Kingdom</option>
                  <option value="IE">Ireland</option>
                  <option value="OTHER">Other (contact us)</option>
                </Select>
              </Field>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <Annotation>SHIPPING METHOD</Annotation>
            <div className="flex flex-col gap-2 text-[13px]">
              <label className="flex items-center justify-between gap-2 border-2 border-ink rounded-md p-3 bg-paper-strong hover:bg-yellow/20 cursor-pointer tabular-nums">
                <span className="flex items-center gap-2">
                  <input type="radio" name="ship" defaultChecked value="tracked" />
                  Royal Mail Tracked (2–3 working days)
                </span>
                <span className="font-display">
                  {shipping === 0 ? "Free" : formatGBP(3.5)}
                </span>
              </label>
              <label className="flex items-center justify-between gap-2 border-2 border-ink rounded-md p-3 bg-paper-strong hover:bg-yellow/20 cursor-pointer tabular-nums">
                <span className="flex items-center gap-2">
                  <input type="radio" name="ship" value="special" />
                  Royal Mail Special Delivery (next working day, signed)
                </span>
                <span className="font-display">{formatGBP(9.95)}</span>
              </label>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <Annotation>PAYMENT</Annotation>
            <div className="border-2 border-ink rounded-md p-3 flex flex-col gap-2 bg-paper-strong">
              <div className="flex justify-between items-center">
                <span className="font-display text-[12px] tracking-wider uppercase">
                  Card payment
                </span>
                <span className="text-[11px] text-muted font-display tracking-wider">
                  via Stripe
                </span>
              </div>
              <div className="border-2 border-dashed border-rule rounded-md p-6 text-center text-muted text-[12px] font-display tracking-wider">
                STRIPE ELEMENTS PLACEHOLDER
              </div>
              <TodoMarker phase={4}>real Stripe Payment Element + 3DS</TodoMarker>
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <Annotation>TERMS</Annotation>
            <label className="flex items-start gap-2 text-[12px]">
              <input type="checkbox" required />
              <span>
                I agree to the{" "}
                <Link href="#" className="underline">cardbuy buyer terms</Link>{" "}
                and consent to my address being used for shipping.
              </span>
            </label>
          </section>

          <Button type="submit" size="lg" className="w-full">
            Pay {formatGBP(total)} →
          </Button>
        </form>

        <aside className="pop-block bg-paper-strong rounded-md p-5 flex flex-col gap-3 sticky top-[80px]">
          <Annotation>SUMMARY</Annotation>
          <div className="flex justify-between text-[13px] tabular-nums">
            <span className="text-secondary">Items</span>
            <span className="font-display">{itemCount}</span>
          </div>
          <div className="flex justify-between text-[13px] tabular-nums">
            <span className="text-secondary">Subtotal</span>
            <span className="font-display">{formatGBP(subtotal)}</span>
          </div>
          <div className="flex justify-between text-[13px] tabular-nums">
            <span className="text-secondary">Shipping</span>
            <span className="font-display">
              {shipping === 0 ? "Free" : formatGBP(shipping)}
            </span>
          </div>
          <div className="border-t-[3px] border-ink pt-3 flex justify-between items-baseline">
            <span className="text-[10px] font-display uppercase tracking-wider text-secondary">
              Total
            </span>
            <span className="font-display text-[24px] tabular-nums leading-none">
              {formatGBP(total)}
            </span>
          </div>
          <Link
            href="/shop/cart"
            className="text-[11px] font-display tracking-wider underline underline-offset-4 decoration-2 text-muted hover:text-pink"
          >
            ← back to basket
          </Link>
        </aside>
      </div>
    </div>
  );
}
