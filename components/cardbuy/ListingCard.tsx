"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import type { MockListing } from "@/lib/mock/types";
import { CardImage } from "@/components/cardbuy/CardImage";
import { formatGBP } from "@/lib/mock/mock-offer";
import { ParticleField } from "@/components/cardbuy/particles/ParticleField";
import {
  TYPE_GLOW_HEX,
  type ElementalType,
} from "@/components/cardbuy/particles/recipes";

type Props = {
  listing: MockListing;
  /** Smaller layout for use in horizontal rails. */
  compact?: boolean;
  /** Chooses which accent takes the biggest burst layer behind the card. */
  accent?: "pink" | "teal" | "yellow";
  /** Gen-1 TCG energy type — drives the per-element hover particle
   *  field. Caller is responsible for looking it up from the card
   *  catalogue; a null/undefined disables particles for this tile. */
  elementalType?: ElementalType | null;
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
  /** Size of the pop-block style ink shadow (SVG units; 200-unit viewBox). */
  shadow?: number;
  strokeWidth?: number;
};

function Burst({
  points,
  fill,
  className = "",
  shadow,
  strokeWidth = 5,
}: BurstProps) {
  return (
    <svg
      viewBox="-16 -16 232 232"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      className={`absolute pointer-events-none ${className}`.trim()}
    >
      {shadow ? (
        <polygon
          points={points}
          fill="var(--color-ink)"
          transform={`translate(${shadow} ${shadow})`}
        />
      ) : null}
      <polygon
        points={points}
        fill={fill}
        stroke="var(--color-ink)"
        strokeWidth={strokeWidth}
        strokeLinejoin="miter"
      />
    </svg>
  );
}

const BURST_PALETTE: Record<
  NonNullable<Props["accent"]>,
  { primary: string; secondary: string }
> = {
  // "Yellow" accent became a paper-white primary with a teal peek —
  // the yellow-on-pink was too close to the section backdrop and
  // read as tacky. White halo is cleaner and still brand-correct.
  yellow: {
    primary: "var(--color-paper-strong)",
    secondary: "var(--color-teal)",
  },
  teal: {
    primary: "var(--color-teal)",
    secondary: "var(--color-paper-strong)",
  },
  pink: {
    primary: "var(--color-paper-strong)",
    secondary: "var(--color-teal)",
  },
};

/**
 * Shopfront listing tile. Shows the real card artwork via {@link CardImage}
 * (which carries the rarity-aware holo + sparkle treatment) inside a
 * layered pop-art starburst well — comic-book "BAM" aesthetic that
 * matches the brand palette.
 */
export function ListingCard({
  listing,
  accent = "yellow",
  elementalType,
}: Props) {
  const [hovered, setHovered] = useState(false);
  // Mobile has no hover — fall back to the card's own tilt engagement.
  // A swipe across the card sets `card-3d-engaged` on its wrapper; the
  // CardImage fires `onEngagedChange` on the flip so we can mirror the
  // same particle activation here without duplicating gesture logic.
  const [tilted, setTilted] = useState(false);
  const particlesActive = hovered || tilted;
  const inStock = listing.qty_in_stock - listing.qty_reserved;
  const soldOut = listing.status === "sold_out" || inStock <= 0;
  const variantLabel =
    listing.variant === "raw"
      ? `Raw · ${listing.condition}`
      : `Graded · ${listing.grading_company} ${listing.grade}`;

  const palette = BURST_PALETTE[accent];
  const typeGlow = elementalType ? TYPE_GLOW_HEX[elementalType] : null;
  const glowStyle: CSSProperties | undefined = typeGlow
    ? ({ ["--type-glow"]: typeGlow } as CSSProperties)
    : undefined;

  return (
    <Link
      href={`/shop/${listing.id}`}
      className="group block"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      {/*
       * Overflow is deliberately visible at this level + below so the
       * particle field can spill out of the tile and fade cleanly as
       * it leaves — see the particle container's negative insets.
       */}
      <div
        className="relative flex justify-end flex-col items-center pt-6 pb-4 min-h-[310px] overflow-visible"
        style={glowStyle}
      >
        {/*
         * Burst layer — the two starburst SVGs plus a type-coloured
         * drop-shadow that blooms on hover. The `--type-glow` CSS var
         * is set on the well div above; the filter reads it so each
         * card's bursts glow in the right palette colour without any
         * per-card JS switchery.
         */}
        <div
          className={`absolute inset-0 transition-[filter] duration-300 pointer-events-none ${
            typeGlow
              ? "group-hover:[filter:drop-shadow(0_0_28px_var(--type-glow))_drop-shadow(0_0_12px_var(--type-glow))]"
              : ""
          }`}
        >
          <Burst
            points={BURST_A}
            fill={palette.primary}
            shadow={8}
            strokeWidth={5}
            className="left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92%] h-[92%] rotate-[-10deg] transition-transform duration-[450ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:rotate-[-16deg] group-hover:scale-[1.06]"
          />
          <Burst
            points={BURST_C}
            fill={palette.secondary}
            shadow={5}
            strokeWidth={5}
            className="top-[3%] right-[3%] w-[38%] h-[38%] rotate-[22deg] transition-transform duration-[450ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:rotate-[40deg] group-hover:scale-[1.18] group-hover:translate-x-[6px] group-hover:-translate-y-[6px]"
          />
        </div>

        {/*
         * Particle field — sized deliberately LARGER than the burst
         * well so particles emitting from the card perimeter have
         * room to travel beyond the tile before alpha hits zero, and
         * nothing clips them at the tile edge. Bottom bleed is kept
         * smaller so the card meta block below isn't shadowed by
         * rogue particles.
         */}
        <div className="absolute -top-12 -left-12 -right-12 -bottom-4 z-[1] overflow-visible pointer-events-none">
          <ParticleField type={elementalType} active={particlesActive} />
        </div>

        <div className="relative z-[2]">
          <CardImage
            src={listing.image_url}
            alt={listing.card_name}
            size="md"
            rarity={listing.rarity}
            interactive
            hideBadge
            onEngagedChange={setTilted}
          />
          {soldOut ? (
            <span className="absolute -top-2 -right-2 z-[5] bg-warn text-paper-strong border-2 border-ink px-1.5 py-0.5 text-[9px] font-display tracking-wider rotate-[3deg] pointer-events-none">
              Sold out
            </span>
          ) : null}
        </div>
      </div>
      {/*
       * Meta block sits ABOVE the particle field (z-3 > particle z-1)
       * so particles drifting out the bottom of the well pass behind
       * the card name / price rather than across the text. `relative`
       * is required for z-index to apply. `overflow-visible` is
       * explicit so the pop-block's 4px ink drop-shadow isn't clipped
       * by any cascading rule.
       */}
      <div className="pop-block bg-paper-strong rounded-md px-4 pt-3 pb-3 flex flex-col gap-1 relative z-[3] overflow-visible">
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
