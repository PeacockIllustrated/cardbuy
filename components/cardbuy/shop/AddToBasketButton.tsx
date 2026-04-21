"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Form";
import { addToCart, useCart } from "@/lib/shop/cart";
import type { MockListing } from "@/lib/mock/types";

/**
 * Card-detail "add to basket" control. Persists to localStorage via
 * `lib/shop/cart.ts`. Shows the current-in-cart quantity under the
 * button so the buyer sees their own additions take effect.
 *
 * Stock reservation doesn't happen here — it only happens server-side
 * when checkout submits. Users can absolutely over-add in their cart
 * then get bounced back to pick fewer; the alternative (reserve on
 * add) requires cart persistence, which is out of scope for Phase 7.
 */
export function AddToBasketButton({
  listing,
  disabled,
}: {
  listing: MockListing;
  disabled: boolean;
}) {
  const inStock = listing.qty_in_stock - listing.qty_reserved;
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const { lines, hydrated } = useCart();
  const inCart = lines.find((l) => l.listingId === listing.id)?.qty ?? 0;

  const handleAdd = () => {
    addToCart(listing.id, qty);
    setAdded(true);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-display text-[11px] tracking-wider">
          Quantity
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            disabled={disabled || qty <= 1}
          >
            −
          </Button>
          <span className="font-display text-[18px] min-w-12 text-center tabular-nums">
            {qty}
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setQty((q) => Math.min(inStock, q + 1))}
            disabled={disabled || qty >= inStock}
          >
            +
          </Button>
        </div>
        <span className="text-[11px] text-muted">max {inStock}</span>
      </div>

      <Button size="lg" disabled={disabled} className="w-full" onClick={handleAdd}>
        {added ? "✓ Added" : "Add to basket →"}
      </Button>

      {hydrated && inCart > 0 ? (
        <p className="text-[11px] text-secondary text-center">
          You have {inCart} of these in your basket.{" "}
          <Link
            href="/shop/cart"
            className="underline decoration-2 underline-offset-2 hover:text-pink"
          >
            Review basket →
          </Link>
        </p>
      ) : null}
    </div>
  );
}
