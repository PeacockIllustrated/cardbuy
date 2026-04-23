"use client";

import { useCallback, useEffect, useRef } from "react";
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
 *   outer edge it's `MAX_PX_PER_FRAME`. Between, linear. The cursor
 *   flips to `w-resize` / `e-resize` when in a scroll zone so the
 *   user has feedback that their position is driving motion.
 *
 * Silhouette:
 * - Two starburst SVGs break out behind the frame (top-left pink,
 *   bottom-right teal) so the yellow stage doesn't read as a plain
 *   rectangle.
 * - A chunky "LEWIS'S PICKS" sticker sits astride the top edge,
 *   rotated and ink-shadowed for the sticker-over-poster vibe.
 */
export function FeaturedRail({ featured }: { featured: MockListing[] }) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const speedRef = useRef(0);

  const step = useCallback(() => {
    const el = railRef.current;
    if (!el || speedRef.current === 0) {
      rafRef.current = null;
      return;
    }
    el.scrollLeft += speedRef.current;
    rafRef.current = requestAnimationFrame(step);
  }, []);

  const handleMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const surface = surfaceRef.current;
      if (!surface) return;
      const rect = surface.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width; // 0..1

      let speed = 0;
      let cursor = "";
      if (x < EDGE_ZONE_FRACTION) {
        // Depth into the left zone: 1 at the outer edge, 0 at the
        // inner boundary of the zone.
        const depth = 1 - x / EDGE_ZONE_FRACTION;
        speed = -depth * MAX_PX_PER_FRAME;
        cursor = "w-resize";
      } else if (x > 1 - EDGE_ZONE_FRACTION) {
        const depth = (x - (1 - EDGE_ZONE_FRACTION)) / EDGE_ZONE_FRACTION;
        speed = depth * MAX_PX_PER_FRAME;
        cursor = "e-resize";
      }

      speedRef.current = speed;
      surface.style.cursor = cursor;

      if (speed !== 0 && rafRef.current == null) {
        rafRef.current = requestAnimationFrame(step);
      }
    },
    [step],
  );

  const handleLeave = useCallback(() => {
    speedRef.current = 0;
    if (surfaceRef.current) surfaceRef.current.style.cursor = "";
  }, []);

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

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
        className="absolute -top-10 -left-14 md:-left-16 w-[170px] md:w-[190px] h-[170px] md:h-[190px] rotate-[-12deg] pointer-events-none z-0"
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
        className="absolute -bottom-10 -right-10 md:-right-12 w-[140px] md:w-[160px] h-[140px] md:h-[160px] rotate-[22deg] pointer-events-none z-0 hidden sm:block"
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
       *  the inner rail div below. */}
      <div className="relative z-10 bg-yellow border-[3px] border-ink rounded-lg shadow-[8px_8px_0_0_var(--color-ink)] pt-8 pb-5">
        <div
          ref={surfaceRef}
          className="relative"
          onMouseMove={handleMove}
          onMouseLeave={handleLeave}
        >
          <div
            ref={railRef}
            className="overflow-x-auto snap-x snap-mandatory scrollbar-none"
          >
            <ul className="flex gap-4 md:gap-5 px-5 md:px-10 w-max">
              {featured.map((l, i) => (
                <li
                  key={l.id}
                  className="snap-start shrink-0 w-[210px] md:w-[240px]"
                >
                  <ListingCard
                    listing={l}
                    compact
                    accent={ACCENT_CYCLE[i % ACCENT_CYCLE.length]}
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
