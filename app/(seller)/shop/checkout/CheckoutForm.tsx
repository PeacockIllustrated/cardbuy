"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Annotation } from "@/components/wireframe/Annotation";
import { Button, Field, Input, Select } from "@/components/ui/Form";
import { clearCart, useCart, type CartLine } from "@/lib/shop/cart";
import {
  createOrder,
  getListingsByIds,
  type EnrichedListing,
} from "@/app/_actions/shop";
import { formatGBP } from "@/lib/mock/mock-offer";
import type { ShippingMethodOption } from "@/lib/supabase/types";

const SHIPPING_LABELS: Record<
  ShippingMethodOption,
  { label: string; price: number; eta: string }
> = {
  royal_mail_tracked: {
    label: "Royal Mail Tracked",
    price: 4.95,
    eta: "2–3 working days",
  },
  royal_mail_special: {
    label: "Royal Mail Special Delivery",
    price: 9.95,
    eta: "next working day, signed",
  },
};

export function CheckoutForm({
  defaultName,
  defaultEmail,
  defaultPostcode,
  defaultCountry,
}: {
  defaultName: string;
  defaultEmail: string;
  defaultPostcode: string;
  defaultCountry: string;
}) {
  const router = useRouter();
  const { lines, hydrated } = useCart();
  const [resolved, setResolved] = useState<
    Array<{ line: CartLine; listing: EnrichedListing }> | null
  >(null);

  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [postcode, setPostcode] = useState(defaultPostcode);
  const [country, setCountry] = useState(defaultCountry);
  const [shipMethod, setShipMethod] =
    useState<ShippingMethodOption>("royal_mail_tracked");
  const [addToBinder, setAddToBinder] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const cartKey = hydrated
    ? lines.map((l) => `${l.listingId}:${l.qty}`).join("|")
    : null;

  useEffect(() => {
    if (cartKey === null) return;
    if (lines.length === 0) return; // empty state derived below
    let cancelled = false;
    getListingsByIds(lines.map((l) => l.listingId)).then((listings) => {
      if (cancelled) return;
      const byId = new Map(listings.map((l) => [l.id, l]));
      const out: Array<{ line: CartLine; listing: EnrichedListing }> = [];
      for (const line of lines) {
        const listing = byId.get(line.listingId);
        if (!listing) continue;
        out.push({ line, listing });
      }
      setResolved(out);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey]);

  // Empty state is derived rather than tracked in `resolved`.

  const subtotal =
    resolved?.reduce(
      (s, r) => s + Number(r.listing.price_gbp) * r.line.qty,
      0,
    ) ?? 0;
  const shippingCost = SHIPPING_LABELS[shipMethod].price;
  const effectiveShipping = subtotal >= 250 ? 0 : shippingCost;
  const total = subtotal + effectiveShipping;
  const itemCount =
    resolved?.reduce((s, r) => s + r.line.qty, 0) ?? 0;

  const canSubmit =
    hydrated &&
    resolved !== null &&
    resolved.length > 0 &&
    termsAccepted &&
    !pending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !resolved) return;
    setError(null);

    start(async () => {
      try {
        const result = await createOrder({
          cart: resolved.map((r) => ({
            listingId: r.listing.id,
            qty: r.line.qty,
          })),
          buyerName: name,
          buyerEmail: email,
          shippingAddress: {
            line1,
            line2: line2 || null,
            city,
            postcode,
            country,
          },
          shippingMethod: shipMethod,
          addToBinderOptIn: addToBinder,
        });
        clearCart();
        router.push(`/shop/order/${result.reference}?just_placed=1`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Checkout failed.");
      }
    });
  };

  // Empty state is derived rather than tracked in `resolved`. The
  // four-branch order is hydration → cart-empty → fetching → race
  // (resolved came back empty), each with its own UI.
  if (!hydrated) {
    return (
      <div className="pop-card rounded-md p-8 text-center text-secondary">
        Loading basket…
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="pop-card rounded-md p-12 text-center flex flex-col gap-4 items-center">
        <span className="font-display text-[22px]">
          Your basket is empty
        </span>
        <Link href="/shop">
          <Button>Browse the shop</Button>
        </Link>
      </div>
    );
  }

  if (resolved === null) {
    return (
      <div className="pop-card rounded-md p-8 text-center text-secondary">
        Loading basket…
      </div>
    );
  }

  if (resolved.length === 0) {
    return (
      <div className="pop-card rounded-md p-12 text-center flex flex-col gap-4 items-center">
        <span className="font-display text-[22px]">
          Your basket is empty
        </span>
        <Link href="/shop">
          <Button>Browse the shop</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6 items-start">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-6 pop-card rounded-md p-5"
      >
        <section className="flex flex-col gap-3">
          <Annotation>BUYER DETAILS</Annotation>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Full name">
              <Input
                name="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Email">
              <Input
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <Annotation>SHIPPING ADDRESS</Annotation>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Address line 1" className="md:col-span-2">
              <Input
                required
                value={line1}
                onChange={(e) => setLine1(e.target.value)}
              />
            </Field>
            <Field
              label="Address line 2 (optional)"
              className="md:col-span-2"
            >
              <Input
                value={line2}
                onChange={(e) => setLine2(e.target.value)}
              />
            </Field>
            <Field label="Town / city">
              <Input
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </Field>
            <Field label="Postcode">
              <Input
                required
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
              />
            </Field>
            <Field label="Country">
              <Select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              >
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
            {(Object.keys(SHIPPING_LABELS) as ShippingMethodOption[]).map(
              (method) => {
                const info = SHIPPING_LABELS[method];
                const actualPrice =
                  subtotal >= 250 && method === "royal_mail_tracked"
                    ? 0
                    : info.price;
                return (
                  <label
                    key={method}
                    className="flex items-center justify-between gap-2 border-2 border-ink rounded-md p-3 bg-paper-strong hover:bg-yellow/20 cursor-pointer tabular-nums"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="ship"
                        checked={shipMethod === method}
                        onChange={() => setShipMethod(method)}
                      />
                      {info.label} ({info.eta})
                    </span>
                    <span className="font-display">
                      {actualPrice === 0 ? "Free" : formatGBP(actualPrice)}
                    </span>
                  </label>
                );
              },
            )}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <Annotation>PAYMENT</Annotation>
          <div className="border-2 border-dashed border-ink rounded-md p-4 bg-paper-strong flex flex-col gap-2">
            <div className="font-display text-[12px] tracking-wider uppercase">
              Stripe not live yet
            </div>
            <p className="text-[12px] text-secondary">
              We&rsquo;re finishing the payment integration. For now,
              placing this order sends it straight to Lewis — you&rsquo;ll
              receive an email when payment capture is ready.
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <Annotation>ADD TO BINDER</Annotation>
          <label className="flex items-start gap-2 text-[12px]">
            <input
              type="checkbox"
              checked={addToBinder}
              onChange={(e) => setAddToBinder(e.target.checked)}
            />
            <span>
              Add these cards to my binder once they arrive (we&rsquo;ll
              do this automatically when the order is marked delivered).
            </span>
          </label>
        </section>

        <section className="flex flex-col gap-2">
          <Annotation>TERMS</Annotation>
          <label className="flex items-start gap-2 text-[12px]">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              required
            />
            <span>
              I agree to the{" "}
              <Link href="#" className="underline">
                cardbuy buyer terms
              </Link>{" "}
              and consent to my address being used for shipping.
            </span>
          </label>
        </section>

        {error ? (
          <div
            role="alert"
            className="text-[12px] text-warn bg-warn/10 border-2 border-warn rounded-sm px-3 py-2"
          >
            {error}
          </div>
        ) : null}

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={!canSubmit}
        >
          {pending ? "Placing order…" : `Pay ${formatGBP(total)} →`}
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
            {effectiveShipping === 0 ? "Free" : formatGBP(effectiveShipping)}
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
  );
}
