import Link from "next/link";
import type { MockListing } from "@/lib/mock/types";
import { CardImage } from "@/components/cardbuy/CardImage";
import { formatGBP } from "@/lib/mock/mock-offer";

type Props = {
  listing: MockListing;
  /** Smaller layout for use in horizontal rails. */
  compact?: boolean;
  /** Chooses which accent takes the biggest burst layer behind the card. */
  accent?: "pink" | "teal" | "yellow";
};

/**
 * Deterministic starburst polygon — built once at module load so SSR
 * and client hydration see identical markup. 10 spikes with slightly
 * varied inner radii so it reads as comic-book / pop-art rather than
 * geometric.
 */
function buildBurstPoints(
  spikes: number,
  outer: number,
  innerMin: number,
  innerMax: number,
): string {
  const out: string[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const theta = (i * Math.PI) / spikes - Math.PI / 2;
    const r =
      i % 2 === 0
        ? outer
        : innerMin + ((i % 4) / 4) * (innerMax - innerMin);
    out.push(
      `${(100 + Math.cos(theta) * r).toFixed(2)},${(100 + Math.sin(theta) * r).toFixed(2)}`,
    );
  }
  return out.join(" ");
}

const BURST_A = buildBurstPoints(10, 96, 52, 62);
const BURST_B = buildBurstPoints(12, 94, 58, 66);
const BURST_C = buildBurstPoints(8, 98, 48, 58);

type BurstProps = {
  points: string;
  fill: string;
  className?: string;
};

function Burst({ points, fill, className = "" }: BurstProps) {
  return (
    <svg
      viewBox="0 0 200 200"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      className={`absolute pointer-events-none ${className}`.trim()}
    >
      <polygon
        points={points}
        fill={fill}
        stroke="var(--color-ink)"
        strokeWidth="4"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

const BURST_PALETTE: Record<
  NonNullable<Props["accent"]>,
  { primary: string; secondary: string; tertiary: string }
> = {
  yellow: {
    primary: "var(--color-yellow)",
    secondary: "var(--color-pink)",
    tertiary: "var(--color-teal)",
  },
  teal: {
    primary: "var(--color-teal)",
    secondary: "var(--color-pink)",
    tertiary: "var(--color-yellow)",
  },
  pink: {
    primary: "var(--color-pink)",
    secondary: "var(--color-yellow)",
    tertiary: "var(--color-teal)",
  },
};

/**
 * Shopfront listing tile. Shows the real card artwork via {@link CardImage}
 * (which carries the rarity-aware holo + sparkle treatment) inside a
 * layered pop-art starburst well — comic-book "BAM" aesthetic that
 * matches the brand palette.
 */
export function ListingCard({ listing, accent = "yellow" }: Props) {
  const inStock = listing.qty_in_stock - listing.qty_reserved;
  const soldOut = listing.status === "sold_out" || inStock <= 0;
  const variantLabel =
    listing.variant === "raw"
      ? `Raw · ${listing.condition}`
      : `Graded · ${listing.grading_company} ${listing.grade}`;

  const palette = BURST_PALETTE[accent];

  return (
    <Link
      href={`/shop/${listing.id}`}
      className="group block pop-block bg-paper-strong rounded-md overflow-hidden"
    >
      <div className="relative bg-paper border-b-[3px] border-ink px-3 pt-5 pb-6 flex justify-center overflow-hidden min-h-[280px]">
        {/* Pop-art starburst backdrop. Primary burst matches the accent
            colour and sits dead centre; the two supporting bursts in
            the complementary brand colours bleed off-edge to give the
            well a "BAM" comic explosion silhouette. */}
        <Burst
          points={BURST_A}
          fill={palette.primary}
          className="left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] rotate-[-6deg]"
        />
        <Burst
          points={BURST_B}
          fill={palette.secondary}
          className="right-[-30%] top-[-20%] w-[95%] h-[95%] rotate-[18deg] opacity-95"
        />
        <Burst
          points={BURST_C}
          fill={palette.tertiary}
          className="left-[-25%] bottom-[-15%] w-[80%] h-[80%] rotate-[-22deg] opacity-95"
        />

        <div className="relative z-[1]">
          <CardImage
            src={listing.image_url}
            alt={listing.card_name}
            size="md"
            rarity={listing.rarity}
            interactive
            hideBadge
          />
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
