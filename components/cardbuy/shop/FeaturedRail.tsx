"use client";

import { useEffect, useRef } from "react";
import type { MockListing } from "@/lib/mock/types";
import { ListingCard } from "@/components/cardbuy/ListingCard";

/** Outer fraction of the rail width (each side) that triggers scroll. */
const EDGE_ZONE_FRACTION = 0.2;
/** Peak scroll speed when the cursor sits at the outer edge. */
const MAX_PX_PER_FRAME = 11;
const ACCENT_CYCLE = ["pink", "teal", "yellow"] as const;

/**
 * Deterministic starburst polygon generator — identical algorithm to
 * the one in `ListingCard`, kept local so this decorative component
 * stays self-contained. Called at module load so the server and client
 * serialise identical markup.
 */
function buildBurst(
  spikes: number,
  outer: number,
  innerMin: number,
  innerMax: number,
): string {
  const pts: string[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const theta = (i * Math.PI) / spikes - Math.PI / 2;
    const r =
      i % 2 === 0
        ? outer
        : innerMin + ((i % 4) / 4) * (innerMax - innerMin);
    pts.push(
      `${(100 + Math.cos(theta) * r).toFixed(2)},${(100 + Math.sin(theta) * r).toFixed(2)}`,
    );
  }
  return pts.join(" ");
}

const BURST_LG = buildBurst(10, 96, 52, 62);
const BURST_SM = buildBurst(8, 98, 48, 58);

/**
 * Shopfront featured section — horizontally-scrollable rail of
 * Lewis's picks on a yellow pop-block stage.
 *
 * Interaction:
 * - Mobile: native touch swipe via `overflow-x-auto`.
 * - Desktop: cursor position within the rail drives the scroll speed.
 *   Sitting in the outer 20% of the rail width on either side ramps
 *   the scroll — at the inner boundary the speed is zero, at the
 *   outer edge it's `MAX_PX_PER_FRAME`. Between, linear. We attach
 *   the pointer listener as a native DOM event (not React synthetic)
 *   so it fires reliably over nested link/card children; the surface
 *   carries a `data-scroll` attribute that a CSS rule uses to force
 *   the right resize cursor through the UA link cursor.
 */
export function FeaturedRail({ featured }: { featured: MockListing[] }) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const speedRef = useRef(0);

  // Persistent rAF loop — always running while mounted, drives the
  // rail's scrollLeft from whatever speed the mousemove handler has
  // stashed. No bookkeeping of "is a frame scheduled", which made an
  // earlier conditional-schedule version susceptible to getting stuck
  // with a stale rafRef.current != null never clearing.
  useEffect(() => {
    let rafId = 0;
    const loop = () => {
      const el = railRef.current;
      const speed = speedRef.current;
      if (el && speed !== 0) {
        el.scrollLeft += speed;
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;

    const handleMove = (e: MouseEvent) => {
      const rect = surface.getBoundingClientRect();
      if (rect.width === 0) return;
      const x = (e.clientX - rect.left) / rect.width;

      let speed = 0;
      let mode = "";
      if (x >= 0 && x < EDGE_ZONE_FRACTION) {
        const depth = 1 - x / EDGE_ZONE_FRACTION;
        speed = -depth * MAX_PX_PER_FRAME;
        mode = "left";
      } else if (x <= 1 && x > 1 - EDGE_ZONE_FRACTION) {
        const depth = (x - (1 - EDGE_ZONE_FRACTION)) / EDGE_ZONE_FRACTION;
        speed = depth * MAX_PX_PER_FRAME;
        mode = "right";
      }

      speedRef.current = speed;
      if (surface.dataset.scroll !== mode) surface.dataset.scroll = mode;
    };

    const handleLeave = () => {
      speedRef.current = 0;
      surface.dataset.scroll = "";
    };

    surface.addEventListener("mousemove", handleMove);
    surface.addEventListener("mouseleave", handleLeave);
    return () => {
      surface.removeEventListener("mousemove", handleMove);
      surface.removeEventListener("mouseleave", handleLeave);
    };
  }, []);

  if (featured.length === 0) return null;

  return (
    <section
      className="relative mt-4 mb-6 max-w-[960px] mx-auto w-full"
      aria-label="Lewis's featured picks"
    >
      {/* Silhouette-breaking starbursts behind the stage. Sized and
       *  offset so they visibly poke out around the yellow frame's
       *  corners rather than disappearing behind it. */}
      <svg
        viewBox="0 0 200 200"
        aria-hidden="true"
        className="absolute -top-16 -left-20 md:-left-24 w-[220px] md:w-[260px] h-[220px] md:h-[260px] rotate-[-12deg] pointer-events-none z-0"
      >
        <polygon
          points={BURST_LG}
          fill="var(--color-ink)"
          transform="translate(6 6)"
        />
        <polygon
          points={BURST_LG}
          fill="var(--color-pink)"
          stroke="var(--color-ink)"
          strokeWidth="5"
        />
      </svg>
      <svg
        viewBox="0 0 200 200"
        aria-hidden="true"
        className="absolute -bottom-14 -right-14 md:-right-16 w-[180px] md:w-[210px] h-[180px] md:h-[210px] rotate-[22deg] pointer-events-none z-0 hidden sm:block"
      >
        <polygon
          points={BURST_SM}
          fill="var(--color-ink)"
          transform="translate(5 5)"
        />
        <polygon
          points={BURST_SM}
          fill="var(--color-teal)"
          stroke="var(--color-ink)"
          strokeWidth="5"
        />
      </svg>

      {/* Sticker badge — sits over the top edge of the yellow stage. */}
      <div
        aria-hidden="true"
        className="absolute -top-4 md:-top-5 left-10 md:left-14 z-20 bg-ink text-paper-strong font-display tracking-wider text-[14px] md:text-[18px] leading-none px-3 py-2 border-[3px] border-ink rotate-[-3deg] shadow-[4px_4px_0_0_var(--color-pink)] uppercase select-none"
      >
        Lewis&apos;s picks
      </div>

      {/* The yellow stage. overflow-visible so the sticker badge and
       *  drop shadow aren't clipped. Horizontal overflow is handled by
       *  the inner rail div below. `pt-0` pushes the rail's clip box
       *  flush with the yellow frame's interior top edge — so the
       *  particle field (which extends -48px above each card) is
       *  allowed to paint all the way up to that edge before clipping. */}
      <div className="relative z-10 bg-yellow border-[3px] border-ink rounded-lg shadow-[8px_8px_0_0_var(--color-ink)] pt-0 pb-3">
        <div ref={surfaceRef} className="relative featured-rail-surface">
          <div
            ref={railRef}
            className="overflow-x-auto scrollbar-none"
          >
            {/* Vertical padding inside the scroll container. The
             *  `overflow-x-auto` axis also clips Y (a CSS gotcha: any
             *  non-visible overflow forces the other axis to clip), so
             *  we keep the card pushed ~48px from the rail's top edge
             *  to give the particle field (which extends -12/-top-12
             *  → 48px above the tile) exactly enough room to bleed. */}
            <ul className="flex gap-4 md:gap-5 pr-6 md:pr-10 pt-12 pb-6 w-max">
              {featured.map((l, i) => (
                <li
                  key={l.id}
                  className="shrink-0 w-[210px] md:w-[240px] first:ml-3 md:first:ml-5"
                >
                  <ListingCard
                    listing={l}
                    compact
                    accent={ACCENT_CYCLE[i % ACCENT_CYCLE.length]}
                    elementalType={l.elemental_type ?? null}
                  />
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="px-5 md:px-10 pt-3 text-[10px] md:text-[11px] font-display tracking-[0.15em] text-ink/70 uppercase">
          Swipe · or hover the edges
        </div>
      </div>
    </section>
  );
}
