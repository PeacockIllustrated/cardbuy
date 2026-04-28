"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Form";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import {
  removeFromCart,
  setCartQty,
  useCart,
  type CartLine,
} from "@/lib/shop/cart";
import { getListingsByIds, type EnrichedListing } from "@/app/_actions/shop";
import { formatGBP } from "@/lib/mock/mock-offer";

type ResolvedLine = {
  line: CartLine;
  listing: EnrichedListing;
  available: number;
};

export function CartView() {
  const { lines, hydrated } = useCart();
  const [resolved, setResolved] = useState<ResolvedLine[] | null>(null);

  // Derive a dependency key from the cart lines so the fetch effect
  // only re-runs when the cart genuinely changes — stringifying is
  // cheap and stable.
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
      const out: ResolvedLine[] = [];
      for (const line of lines) {
        const listing = byId.get(line.listingId);
        if (!listing) continue;
        out.push({
          line,
          listing,
          available: listing.qty_in_stock - listing.qty_reserved,
        });
      }
      setResolved(out);
    });
    return () => {
      cancelled = true;
    };
    // We intentionally key on `cartKey` rather than `lines` — arrays
    // have unstable identity across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey]);

  // Empty state is derived rather than tracked in `resolved` — that
  // keeps us clear of setState-in-effect and means removing the last
  // line transitions to "empty" immediately, before the next fetch
  // resolves.
  if (!hydrated) {
    return (
      <div className="pop-card rounded-md p-8 text-center text-secondary">
        Loading…
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="pop-card rounded-md p-12 text-center flex flex-col gap-4 items-center">
        <span className="font-display text-[24px]">Your basket is empty</span>
        <Link href="/shop">
          <Button>Browse the shop</Button>
        </Link>
      </div>
    );
  }

  if (resolved === null) {
    return (
      <div className="pop-card rounded-md p-8 text-center text-secondary">
        Loading…
      </div>
    );
  }

  if (resolved.length === 0) {
    return (
      <div className="pop-card rounded-md p-12 text-center flex flex-col gap-4 items-center">
        <span className="font-display text-[24px]">Your basket is empty</span>
        <Link href="/shop">
          <Button>Browse the shop</Button>
        </Link>
      </div>
    );
  }

  const subtotal = resolved.reduce(
    (s, r) => s + Number(r.listing.price_gbp) * r.line.qty,
    0,
  );
  const shipping = subtotal >= 250 ? 0 : 4.95;
  const total = subtotal + shipping;

  const anyOver = resolved.some((r) => r.line.qty > r.available);

  return (
    <>
      <Table>
        <THead>
          <TR>
            <TH>Card</TH>
            <TH>Variant</TH>
            <TH>Qty</TH>
            <TH className="text-right">Unit</TH>
            <TH className="text-right">Line total</TH>
            <TH></TH>
          </TR>
        </THead>
        <TBody>
          {resolved.map((r) => {
            const variant =
              r.listing.variant === "raw"
                ? `Raw · ${r.listing.condition}`
                : `Graded · ${r.listing.grading_company} ${r.listing.grade}`;
            const over = r.line.qty > r.available;
            return (
              <TR key={r.listing.id}>
                <TD>
                  <div className="flex gap-3 items-start">
                    <Link
                      href={`/shop/${r.listing.id}`}
                      className="shrink-0 relative w-[56px] h-[78px] rounded-sm border-2 border-ink overflow-hidden bg-paper"
                    >
                      {r.listing.image_small ? (
                        <Image
                          src={r.listing.image_small}
                          alt={r.listing.card_name}
                          fill
                          sizes="56px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : null}
                    </Link>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <Link
                        href={`/shop/${r.listing.id}`}
                        className="font-display text-[13px] tracking-tight hover:text-pink leading-tight"
                      >
                        {r.listing.card_name}
                      </Link>
                      <span className="text-[11px] text-muted truncate">
                        {r.listing.set_name}
                      </span>
                      <span className="text-[10px] text-muted tabular-nums">
                        SKU {r.listing.sku}
                      </span>
                    </div>
                  </div>
                </TD>
                <TD>
                  <span className="font-display text-[11px] tracking-wider uppercase">
                    {variant}
                  </span>
                </TD>
                <TD>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setCartQty(r.listing.id, r.line.qty - 1)}
                    >
                      −
                    </Button>
                    <span
                      className={`font-display text-[13px] min-w-8 text-center tabular-nums ${
                        over ? "text-warn" : ""
                      }`}
                    >
                      {r.line.qty}
                    </span>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setCartQty(
                          r.listing.id,
                          Math.min(r.available, r.line.qty + 1),
                        )
                      }
                      disabled={r.line.qty >= r.available}
                    >
                      +
                    </Button>
                  </div>
                  {over ? (
                    <span className="text-[10px] text-warn mt-1 block">
                      Only {r.available} in stock
                    </span>
                  ) : null}
                </TD>
                <TD className="text-right tabular-nums">
                  {formatGBP(Number(r.listing.price_gbp))}
                </TD>
                <TD className="text-right tabular-nums font-display">
                  {formatGBP(Number(r.listing.price_gbp) * r.line.qty)}
                </TD>
                <TD>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFromCart(r.listing.id)}
                  >
                    Remove
                  </Button>
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>

      <section className="grid grid-cols-1 md:grid-cols-[1fr_340px] gap-6 items-start">
        <div
          className={`pop-card rounded-md p-4 flex flex-col gap-2 text-[13px] ${
            subtotal >= 250 ? "bg-teal/30" : "bg-yellow/30"
          }`}
        >
          <span className="font-display text-[11px] tracking-wider">
            {subtotal >= 250
              ? "Free shipping unlocked"
              : "Free shipping at £250"}
          </span>
          {subtotal >= 250 ? (
            <p>Your order qualifies for free Royal Mail Tracked.</p>
          ) : (
            <p>
              Add{" "}
              <strong className="font-display">
                {formatGBP(250 - subtotal)}
              </strong>{" "}
              more for free Royal Mail Tracked.
            </p>
          )}
        </div>

        <div className="pop-block bg-paper-strong rounded-lg p-5 flex flex-col gap-3">
          <span className="font-display text-[11px] tracking-wider">Summary</span>
          <div className="flex justify-between text-[14px] tabular-nums">
            <span className="text-secondary">Subtotal</span>
            <span>{formatGBP(subtotal)}</span>
          </div>
          <div className="flex justify-between text-[14px] tabular-nums">
            <span className="text-secondary">Shipping</span>
            <span>{shipping === 0 ? "Free" : formatGBP(shipping)}</span>
          </div>
          <div className="border-t-2 border-ink pt-3 flex justify-between items-baseline">
            <span className="font-display text-[11px] tracking-wider">
              Total
            </span>
            <span className="font-display text-[28px] tabular-nums">
              {formatGBP(total)}
            </span>
          </div>
          {anyOver ? (
            <p className="text-[11px] text-warn">
              Reduce any over-stock lines before checking out.
            </p>
          ) : null}
          <Link href="/shop/checkout">
            <Button size="lg" className="w-full" disabled={anyOver}>
              Continue to checkout →
            </Button>
          </Link>
        </div>
      </section>
    </>
  );
}
