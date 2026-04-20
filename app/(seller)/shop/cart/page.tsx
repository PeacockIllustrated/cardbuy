import Link from "next/link";
import { TodoMarker } from "@/components/wireframe/TodoMarker";
import { Button } from "@/components/ui/Form";
import { CardImage } from "@/components/cardbuy/CardImage";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { MOCK_LISTINGS } from "@/lib/mock/mock-listings";
import { formatGBP } from "@/lib/mock/mock-offer";

// Phase 1: render a sample basket containing 3 listings, no real persistence.
const SAMPLE = [
  { listing: MOCK_LISTINGS.find((l) => l.id === "lst-004")!, qty: 1 },
  { listing: MOCK_LISTINGS.find((l) => l.id === "lst-006")!, qty: 1 },
  { listing: MOCK_LISTINGS.find((l) => l.id === "lst-007")!, qty: 2 },
];

export default function ShopCartPage() {
  const subtotal = SAMPLE.reduce(
    (s, { listing, qty }) => s + listing.price_gbp * qty,
    0
  );
  const shipping = subtotal >= 250 ? 0 : 3.5;
  const total = subtotal + shipping;

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-8 flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <span className="bg-pink text-ink border-2 border-ink w-fit px-2 py-1 font-display text-[10px] tracking-wider">
          Basket
        </span>
        <h1 className="font-display text-[36px] leading-none tracking-tight">
          Your basket
        </h1>
        <TodoMarker phase={2}>persist basket across sessions; reserve stock on add</TodoMarker>
      </header>

      {SAMPLE.length === 0 ? (
        <div className="pop-card rounded-md p-12 text-center flex flex-col gap-4 items-center">
          <span className="font-display text-[24px]">Your basket is empty</span>
          <Link href="/shop">
            <Button>Browse the shop</Button>
          </Link>
        </div>
      ) : (
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
              {SAMPLE.map(({ listing, qty }) => (
                <TR key={listing.id}>
                  <TD>
                    <div className="flex gap-3 items-start">
                      <Link href={`/shop/${listing.id}`} className="shrink-0">
                        <CardImage
                          src={listing.image_url}
                          alt={listing.card_name}
                          size="sm"
                          rarity={listing.rarity}
                          hideBadge
                          static
                        />
                      </Link>
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <Link
                          href={`/shop/${listing.id}`}
                          className="font-display text-[13px] tracking-tight hover:text-pink leading-tight"
                        >
                          {listing.card_name}
                        </Link>
                        <span className="text-[11px] text-muted truncate">
                          {listing.set_name} · {listing.rarity}
                        </span>
                        <span className="text-[10px] text-muted tabular-nums">
                          SKU {listing.sku}
                        </span>
                      </div>
                    </div>
                  </TD>
                  <TD>
                    <span className="font-display text-[11px] tracking-wider uppercase">
                      {listing.variant === "raw"
                        ? `Raw · ${listing.condition}`
                        : `Graded · ${listing.grading_company} ${listing.grade}`}
                    </span>
                  </TD>
                  <TD className="tabular-nums">{qty}</TD>
                  <TD className="text-right tabular-nums">
                    {formatGBP(listing.price_gbp)}
                  </TD>
                  <TD className="text-right tabular-nums font-display">
                    {formatGBP(listing.price_gbp * qty)}
                  </TD>
                  <TD>
                    <Button variant="ghost" size="sm">
                      Remove
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>

          <section className="grid grid-cols-1 md:grid-cols-[1fr_340px] gap-6 items-start">
            <div className={`pop-card rounded-md p-4 flex flex-col gap-2 text-[13px] ${subtotal >= 250 ? "bg-teal/30" : "bg-yellow/30"}`}>
              <span className="font-display text-[11px] tracking-wider">
                {subtotal >= 250 ? "Free shipping unlocked" : "Free shipping at £250"}
              </span>
              {subtotal >= 250 ? (
                <p>Your order qualifies for free Royal Mail Tracked.</p>
              ) : (
                <p>
                  Add <strong className="font-display">{formatGBP(250 - subtotal)}</strong> more
                  for free Royal Mail Tracked.
                </p>
              )}
              <TodoMarker phase={2}>configurable threshold via /admin/pricing</TodoMarker>
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
                <span className="font-display text-[11px] tracking-wider">Total</span>
                <span className="font-display text-[28px] tabular-nums">{formatGBP(total)}</span>
              </div>
              <Link href="/shop/checkout">
                <Button size="lg" className="w-full">
                  Continue to checkout →
                </Button>
              </Link>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
