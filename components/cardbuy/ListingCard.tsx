import Link from "next/link";
import type { MockListing } from "@/lib/mock/types";
import { CardImage } from "@/components/cardbuy/CardImage";
import { formatGBP } from "@/lib/mock/mock-offer";

type Props = {
  listing: MockListing;
  /** Smaller layout for use in horizontal rails. */
  compact?: boolean;
  /** Override the image-well accent. */
  accent?: "pink" | "teal" | "yellow";
};

/**
 * Shopfront listing tile. Shows the real card artwork via {@link CardImage}
 * (which carries the rarity-aware holo + sparkle treatment) rather than
 * the old grayscale placeholder, while keeping the pop-art frame.
 */
export function ListingCard({ listing, compact, accent }: Props) {
  const inStock = listing.qty_in_stock - listing.qty_reserved;
  const soldOut = listing.status === "sold_out" || inStock <= 0;
  const variantLabel =
    listing.variant === "raw"
      ? `Raw · ${listing.condition}`
      : `Graded · ${listing.grading_company} ${listing.grade}`;

  const accentBg =
    accent === "pink"
      ? "bg-pink"
      : accent === "teal"
        ? "bg-teal"
        : accent === "yellow"
          ? "bg-yellow"
          : "bg-paper-strong";

  return (
    <Link
      href={`/shop/${listing.id}`}
      className="group block pop-block bg-paper-strong rounded-md overflow-hidden"
    >
      <div
        className={`${accentBg} border-b-[3px] border-ink px-3 py-4 flex justify-center`}
      >
        <div className="relative">
          <CardImage
            src={listing.image_url}
            alt={listing.card_name}
            size={compact ? "sm" : "md"}
            rarity={listing.rarity}
            hideBadge
          />
          {listing.is_featured ? (
            <span className="absolute -top-2 -left-2 z-[5] bg-yellow text-ink border-2 border-ink px-1.5 py-0.5 text-[9px] font-display tracking-wider rotate-[-4deg] pointer-events-none">
              Featured
            </span>
          ) : null}
          {soldOut ? (
            <span className="absolute -top-2 -right-2 z-[5] bg-warn text-paper-strong border-2 border-ink px-1.5 py-0.5 text-[9px] font-display tracking-wider rotate-[3deg] pointer-events-none">
              Sold out
            </span>
          ) : null}
        </div>
      </div>
      <div className="px-3 pb-3 pt-2 flex flex-col gap-1">
        <div className="font-display text-[13px] md:text-[14px] leading-tight tracking-tight uppercase line-clamp-2 min-h-[28px]">
          {listing.card_name}
        </div>
        <div className="text-[11px] text-muted truncate">
          {listing.set_name} · {listing.rarity}
        </div>
        <div className="text-[11px] text-secondary">{variantLabel}</div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 mt-2 pt-2 border-t-2 border-ink/15">
          <span className="font-display text-[18px] leading-none tracking-tight tabular-nums">
            {formatGBP(listing.price_gbp)}
          </span>
          <span className="text-[11px] text-muted tabular-nums whitespace-nowrap">
            {inStock > 0 ? `${inStock} in stock` : "—"}
          </span>
        </div>
      </div>
    </Link>
  );
}
