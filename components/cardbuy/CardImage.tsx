"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ImagePlaceholder } from "@/components/wireframe/ImagePlaceholder";

type Size = "sm" | "md" | "lg" | "xl";

const DIMS: Record<Size, { w: number; h: number; sizes: string }> = {
  sm: { w: 120, h: 168, sizes: "120px" },
  md: { w: 180, h: 250, sizes: "(min-width: 1024px) 240px, 180px" },
  lg: { w: 280, h: 392, sizes: "(min-width: 1024px) 360px, 280px" },
  xl: { w: 420, h: 588, sizes: "(min-width: 1024px) 480px, 360px" },
};

/** Rarity strings that should render the rainbow holo shimmer. */
const HOLO_RARITIES = new Set([
  "Rare Holo",
  "Rare Holo EX",
  "Rare Holo GX",
  "Rare Holo V",
  "Rare Holo VMAX",
  "Rare Secret",
  "Rare Ultra",
  "Rare Shining",
  "Rare Shiny",
  "Rare Rainbow",
  "Promo",
]);

/** Rarity strings that earn the sparkle layer. Superset of holo — any
 *  chase-worthy card gets the glint. */
const SPARKLE_RARITIES = new Set([
  ...Array.from(HOLO_RARITIES),
  "Rare",
]);

/** Touch engagement constants. */
const TOUCH_HOLD_MS = 500;      // long-press threshold to engage tilt
const TOUCH_SLOP_PX = 10;       // finger wiggle tolerated while waiting
const TILT_MAX_DEG = 22;        // peak rotateX/rotateY per axis
const TILT_LIFT_PX = 22;        // translateZ on engage
const TILT_SCALE = 1.04;        // zoom on engage

type Props = {
  src?: string | null;
  alt: string;
  size?: Size;
  priority?: boolean;
  /** Hide the [real] badge for dense table thumbnails. */
  hideBadge?: boolean;
  /** Enables the holo + sparkle overlays based on the rarity string. */
  rarity?: string | null;
  /** Disable the 3D tilt (e.g. for dense table rows). */
  static?: boolean;
  className?: string;
};

/** Deterministic PRNG from a string seed so a card's sparkle layout is stable. */
function seededRand(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967295;
  };
}

type SparkleSpec = { x: number; y: number; size: number; delay: number };

function buildSparkles(seed: string, count: number): SparkleSpec[] {
  const rand = seededRand(seed);
  const out: SparkleSpec[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      x: 6 + rand() * 88,
      y: 6 + rand() * 88,
      size: 6 + Math.floor(rand() * 9),
      delay: Math.round(rand() * 1200) / 1000,
    });
  }
  return out;
}

function applyTilt(el: HTMLDivElement, clientX: number, clientY: number) {
  const rect = el.getBoundingClientRect();
  const px = (clientX - rect.left) / rect.width;
  const py = (clientY - rect.top) / rect.height;
  const rx = (0.5 - py) * TILT_MAX_DEG * 2;
  const ry = (px - 0.5) * TILT_MAX_DEG * 2;
  el.style.setProperty("--mx", `${(px * 100).toFixed(2)}%`);
  el.style.setProperty("--my", `${(py * 100).toFixed(2)}%`);
  el.style.setProperty("--rx", `${rx.toFixed(2)}deg`);
  el.style.setProperty("--ry", `${ry.toFixed(2)}deg`);
  el.style.setProperty("--lift", `${TILT_LIFT_PX}px`);
  el.style.setProperty("--scale", String(TILT_SCALE));
}

function resetTilt(el: HTMLDivElement) {
  el.style.setProperty("--rx", "0deg");
  el.style.setProperty("--ry", "0deg");
  el.style.setProperty("--lift", "0px");
  el.style.setProperty("--scale", "1");
}

/**
 * Real card art in a pop-art sticker frame. Falls back to the grayscale
 * `ImagePlaceholder` if the image URL is missing or errors.
 *
 * Interactivity:
 * - Desktop: mousemove drives the tilt + cursor-tracked holo shimmer;
 *   sparkles bloom on :hover.
 * - Mobile: press-and-hold for {@link TOUCH_HOLD_MS}ms without exceeding
 *   {@link TOUCH_SLOP_PX}px of movement engages tilt mode. Subsequent
 *   touchmoves update the tilt and are preventDefault'd to stop scroll.
 *   A short tap or a scroll gesture (>slop within the hold window) leaves
 *   the card alone and lets the page behave normally.
 */
export function CardImage({
  src,
  alt,
  size = "md",
  priority = false,
  hideBadge = false,
  rarity,
  static: isStatic = false,
  className = "",
}: Props) {
  const [errored, setErrored] = useState(false);
  const [hovered, setHovered] = useState(false);
  const outerRef = useRef<HTMLDivElement | null>(null);
  const { w, h, sizes } = DIMS[size];

  const interactive = !isStatic && size !== "sm";

  // Native touch handlers — React synthesises touchmove as passive, so
  // preventDefault from React's onTouchMove is unreliable. Attach directly.
  useEffect(() => {
    if (!interactive) return;
    const el = outerRef.current;
    if (!el) return;

    let startX = 0;
    let startY = 0;
    let holdTimer: number | null = null;
    let engaged = false;

    const cancelHoldTimer = () => {
      if (holdTimer !== null) {
        window.clearTimeout(holdTimer);
        holdTimer = null;
      }
    };

    const disengage = () => {
      cancelHoldTimer();
      if (engaged) {
        engaged = false;
        el.classList.remove("card-3d-engaged");
        resetTilt(el);
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      cancelHoldTimer();
      holdTimer = window.setTimeout(() => {
        engaged = true;
        el.classList.add("card-3d-engaged");
        applyTilt(el, startX, startY);
        // Haptic nudge on supported devices so the user knows tilt engaged.
        if ("vibrate" in navigator) navigator.vibrate?.(8);
      }, TOUCH_HOLD_MS);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (engaged) {
        // Stop the page from scrolling while the user drives the tilt.
        e.preventDefault();
        applyTilt(el, t.clientX, t.clientY);
        return;
      }
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (dx * dx + dy * dy > TOUCH_SLOP_PX * TOUCH_SLOP_PX) {
        // Finger moved before the hold threshold — treat as a scroll,
        // leave the card alone.
        cancelHoldTimer();
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", disengage);
    el.addEventListener("touchcancel", disengage);

    return () => {
      cancelHoldTimer();
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", disengage);
      el.removeEventListener("touchcancel", disengage);
    };
  }, [interactive]);

  if (!src || errored) {
    return <ImagePlaceholder w={w} h={h} label={alt} className={className} />;
  }

  const isHolo = rarity ? HOLO_RARITIES.has(rarity) : false;
  const hasSparkles = rarity ? SPARKLE_RARITIES.has(rarity) : false;
  const sparkles = hasSparkles ? buildSparkles(alt, size === "sm" ? 3 : 6) : [];

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!interactive || !outerRef.current) return;
    applyTilt(outerRef.current, e.clientX, e.clientY);
  }

  function handleMouseLeave() {
    const el = outerRef.current;
    if (!el) return;
    resetTilt(el);
    setHovered(false);
  }

  return (
    <div
      ref={outerRef}
      className={`card-3d relative inline-block ${className}`.trim()}
      style={{
        width: w,
        maxWidth: "100%",
        touchAction: interactive ? "pan-y" : undefined,
      }}
      onMouseMove={interactive ? handleMouseMove : undefined}
      onMouseEnter={interactive ? () => setHovered(true) : undefined}
      onMouseLeave={interactive ? handleMouseLeave : undefined}
    >
      <div
        className={`card-3d-inner relative border border-ink rounded-[10px] overflow-hidden bg-ink ${
          isHolo ? "card-holo" : ""
        }`}
        style={{ aspectRatio: `${w} / ${h}` }}
      >
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
          onError={() => setErrored(true)}
        />

        {sparkles.length > 0 ? (
          <div className="card-sparkles" aria-hidden="true">
            {sparkles.map((s, i) => (
              <span
                key={i}
                className="card-sparkle"
                style={
                  {
                    "--sx": `${s.x}%`,
                    "--sy": `${s.y}%`,
                    "--sz": `${s.size}px`,
                    "--sd": `${s.delay}s`,
                  } as CSSProperties
                }
              />
            ))}
          </div>
        ) : null}
      </div>

      {!hideBadge ? (
        <span
          className="absolute top-2 left-2 z-10 font-display text-[9px] tracking-wider bg-yellow text-ink border-2 border-ink px-1.5 py-0.5 rounded-sm pointer-events-none"
          aria-hidden="true"
          style={{ transform: "translateZ(20px)" }}
        >
          [real]
        </span>
      ) : null}

      {hovered && isHolo ? (
        <span className="sr-only">Holo shimmer active</span>
      ) : null}
    </div>
  );
}
