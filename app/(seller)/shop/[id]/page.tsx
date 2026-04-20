import Link from "next/link";
import { notFound } from "next/navigation";
import { TodoMarker } from "@/components/wireframe/TodoMarker";
import { Button } from "@/components/ui/Form";
import { CardImage } from "@/components/cardbuy/CardImage";
import { ListingCard } from "@/components/cardbuy/ListingCard";
import { MOCK_LISTINGS } from "@/lib/mock/mock-listings";
import { formatGBP } from "@/lib/mock/mock-offer";

type Params = Promise<{ id: string }>;

export default async function ListingDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const listing = MOCK_LISTINGS.find((l) => l.id === id);
  if (!listing) notFound();

  const variantLabel =
    listing.variant === "raw"
      ? `Raw · ${listing.condition}`
      : `Graded · ${listing.grading_company} ${listing.grade}`;
  const inStock = listing.qty_in_stock - listing.qty_reserved;
  const soldOut = listing.status !== "active" || inStock <= 0;

  const otherListings = MOCK_LISTINGS.filter(
    (l) => l.card_id === listing.card_id && l.id !== listing.id && l.status === "active"
  );

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-8 flex flex-col gap-8">
      <nav className="text-[12px] font-display tracking-wider text-muted">
        <Link href="/shop" className="hover:text-pink">← Back to shop</Link>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-8 lg:gap-12">
        {/* Image well */}
        <div className="flex flex-col gap-3 items-center">
          <CardImage
            src={listing.image_url}
            alt={listing.card_name}
            size="lg"
            rarity={listing.rarity}
            priority
          />
          <div className="text-[11px] font-display tracking-wider text-muted tabular-nums">
            SKU {listing.sku}
          </div>
        </div>

        {/* Details + buy */}
        <div className="flex flex-col gap-6">
          <header className="flex flex-col gap-2">
            <span className="font-display text-[10px] tracking-wider text-pink">
              {variantLabel}
            </span>
            <h1 className="font-display text-[32px] md:text-[40px] leading-[0.95] tracking-tight">
              {listing.card_name}
            </h1>
            <div className="text-[14px] text-secondary">
              {listing.set_name} · {listing.rarity}
            </div>
          </header>

          <div className="pop-card rounded-lg p-5 flex flex-col gap-4">
            <div className="flex items-baseline justify-between flex-wrap gap-2">
              <span className="font-display text-[44px] leading-none tabular-nums">
                {formatGBP(listing.price_gbp)}
              </span>
              <span
                className={`font-display text-[11px] tracking-wider px-2 py-1 border-2 border-ink ${
                  soldOut ? "bg-warn text-paper-strong border-warn" : "bg-teal text-ink"
                }`}
              >
                {soldOut ? "Sold out" : `${inStock} in stock`}
              </span>
            </div>

            {listing.condition_notes ? (
              <p className="text-[13px] text-secondary bg-yellow/30 border-l-4 border-yellow pl-3 py-2">
                <span className="font-display text-[10px] tracking-wider block">
                  Condition note
                </span>
                {listing.condition_notes}
              </p>
            ) : null}

            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-display text-[11px] tracking-wider">Quantity</span>
              <div className="flex items-center gap-2">
                <Button type="button" variant="secondary" size="sm">−</Button>
                <span className="font-display text-[18px] min-w-12 text-center tabular-nums">
                  1
                </span>
                <Button type="button" variant="secondary" size="sm">+</Button>
              </div>
              <span className="text-[11px] text-muted">max {inStock}</span>
            </div>

            <Button size="lg" disabled={soldOut} className="w-full">
              Add to basket →
            </Button>
            <TodoMarker phase={2}>persist basket; reserve qty on add</TodoMarker>
          </div>

          {otherListings.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="font-display text-[16px] tracking-wider">
                Other listings of this card
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {otherListings.map((l) => (
                  <ListingCard key={l.id} listing={l} compact />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
