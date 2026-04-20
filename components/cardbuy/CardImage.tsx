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
const SWIPE_DECIDE_PX = 8;      // movement needed before we commit to horizontal-swipe vs vertical-scroll
const TILT_MAX_DEG = 22;        // peak rotateX/rotateY per axis
const TILT_LIFT_PX = 22;        // translateZ on engage
const TILT_SCALE = 1.04;        // zoom on engage
/** Device-orientation tuning. Gyro signal is dampened so the card doesn't
 *  snap around — held still, the card sits near rest. */
const GYRO_BETA_NEUTRAL = 45;   // phone held at ~45° feels "flat" in hand
const GYRO_BETA_RANGE = 30;     // ±deg of beta that map to full tilt
const GYRO_GAMMA_RANGE = 30;    // ±deg of gamma that map to full tilt
const GYRO_SMOOTH = 0.82;       // low-pass coefficient
const GYRO_LIFT_PX = 12;        // gentler lift than a swipe
const GYRO_SCALE = 1.02;        // gentler zoom than a swipe

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
  /** Opt-in on the card detail page: drive tilt from the device gyro when
   *  the finger isn't swiping. On iOS the user must tap a permission chip. */
  enableDeviceTilt?: boolean;
  className?: string;
};

/** iOS Safari exposes a static requestPermission() on the DeviceOrientationEvent constructor. */
type DeviceOrientationEventIOS = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

type TiltPermission = "unknown" | "needed" | "granted" | "denied" | "unsupported";

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

function applyTiltRaw(
  el: HTMLDivElement,
  rx: number,
  ry: number,
  lift = TILT_LIFT_PX,
  scale = TILT_SCALE,
) {
  // Drive the holo hotspot from the rotation so the shimmer tracks the tilt
  // direction (gamma → horizontal, beta → vertical).
  const mx = 50 + (ry / TILT_MAX_DEG) * 40;
  const my = 50 - (rx / TILT_MAX_DEG) * 40;
  el.style.setProperty("--mx", `${mx.toFixed(2)}%`);
  el.style.setProperty("--my", `${my.toFixed(2)}%`);
  el.style.setProperty("--rx", `${rx.toFixed(2)}deg`);
  el.style.setProperty("--ry", `${ry.toFixed(2)}deg`);
  el.style.setProperty("--lift", `${lift}px`);
  el.style.setProperty("--scale", String(scale));
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
 * - Mobile (swipe): a horizontal finger movement across the card engages
 *   tilt and locks vertical page scroll until release. A vertical
 *   movement-first leaves the card alone and the page scrolls normally.
 * - Mobile (gyro, opt-in via `enableDeviceTilt`): once permission is
 *   granted, beta/gamma drive the tilt continuously in a "card in hand"
 *   resting state. An active swipe overrides gyro; releasing hands the
 *   tilt back to the gyro.
 */
export function CardImage({
  src,
  alt,
  size = "md",
  priority = false,
  hideBadge = false,
  rarity,
  static: isStatic = false,
  enableDeviceTilt = false,
  className = "",
}: Props) {
  const [errored, setErrored] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [tiltPermission, setTiltPermission] =
    useState<TiltPermission>("unknown");
  const outerRef = useRef<HTMLDivElement | null>(null);
  const swipeActiveRef = useRef(false);
  const tiltPermissionRef = useRef<TiltPermission>("unknown");
  const smoothRxRef = useRef(0);
  const smoothRyRef = useRef(0);
  const { w, h, sizes } = DIMS[size];

  const interactive = !isStatic && size !== "sm";
  const gyroEligible = interactive && enableDeviceTilt;

  useEffect(() => {
    tiltPermissionRef.current = tiltPermission;
  }, [tiltPermission]);

  // Detect device-orientation support + whether an iOS-style permission
  // prompt is required. Android / desktop Chrome fire the event without
  // a gate, so we treat those as implicitly granted.
  useEffect(() => {
    if (!gyroEligible) return;
    if (typeof window === "undefined") return;
    const DOE = (window as unknown as { DeviceOrientationEvent?: DeviceOrientationEventIOS }).DeviceOrientationEvent;
    if (!DOE) {
      setTiltPermission("unsupported");
      return;
    }
    if (typeof DOE.requestPermission === "function") {
      setTiltPermission("needed");
    } else {
      setTiltPermission("granted");
    }
  }, [gyroEligible]);

  // Native touch handlers — React synthesises touchmove as passive, so
  // preventDefault from React's onTouchMove is unreliable. Attach directly.
  useEffect(() => {
    if (!interactive) return;
    const el = outerRef.current;
    if (!el) return;

    let startX = 0;
    let startY = 0;
    let decided = false;
    let engaged = false;

    const disengage = () => {
      if (engaged) {
        engaged = false;
        swipeActiveRef.current = false;
        // If the gyro is driving the card, the next orientation event
        // will re-apply its own tilt. Otherwise fall back to rest.
        if (tiltPermissionRef.current !== "granted") {
          el.classList.remove("card-3d-engaged");
          resetTilt(el);
        }
      }
      decided = false;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      decided = false;
      engaged = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (!decided) {
        const adx = Math.abs(dx);
        const ady = Math.abs(dy);
        if (adx < SWIPE_DECIDE_PX && ady < SWIPE_DECIDE_PX) return;
        decided = true;
        if (adx > ady) {
          engaged = true;
          swipeActiveRef.current = true;
          el.classList.add("card-3d-engaged");
          if ("vibrate" in navigator) navigator.vibrate?.(6);
        } else {
          // Vertical intent — stay out of the way, let the page scroll.
          return;
        }
      }
      if (engaged) {
        // Block vertical scroll while the finger drives the tilt.
        e.preventDefault();
        applyTilt(el, t.clientX, t.clientY);
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", disengage);
    el.addEventListener("touchcancel", disengage);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", disengage);
      el.removeEventListener("touchcancel", disengage);
    };
  }, [interactive]);

  // Attach the device-orientation listener once permission is granted.
  useEffect(() => {
    if (!gyroEligible) return;
    if (tiltPermission !== "granted") return;
    const el = outerRef.current;
    if (!el) return;

    smoothRxRef.current = 0;
    smoothRyRef.current = 0;

    const onOrient = (e: DeviceOrientationEvent) => {
      // Finger wins. Swipe handler is already applying its own tilt.
      if (swipeActiveRef.current) return;
      const beta = e.beta ?? 0;
      const gamma = e.gamma ?? 0;
      const nx = Math.max(
        -1,
        Math.min(1, (beta - GYRO_BETA_NEUTRAL) / GYRO_BETA_RANGE),
      );
      const ny = Math.max(-1, Math.min(1, gamma / GYRO_GAMMA_RANGE));
      const rxTarget = -nx * TILT_MAX_DEG;
      const ryTarget = ny * TILT_MAX_DEG;
      smoothRxRef.current =
        smoothRxRef.current * GYRO_SMOOTH + rxTarget * (1 - GYRO_SMOOTH);
      smoothRyRef.current =
        smoothRyRef.current * GYRO_SMOOTH + ryTarget * (1 - GYRO_SMOOTH);
      applyTiltRaw(
        el,
        smoothRxRef.current,
        smoothRyRef.current,
        GYRO_LIFT_PX,
        GYRO_SCALE,
      );
      el.classList.add("card-3d-engaged");
    };

    window.addEventListener("deviceorientation", onOrient);
    return () => {
      window.removeEventListener("deviceorientation", onOrient);
      // Only reset if the swipe isn't currently owning the transform.
      if (!swipeActiveRef.current) {
        el.classList.remove("card-3d-engaged");
        resetTilt(el);
      }
    };
  }, [gyroEligible, tiltPermission]);

  async function requestTiltPermission() {
    const DOE = (window as unknown as { DeviceOrientationEvent?: DeviceOrientationEventIOS }).DeviceOrientationEvent;
    if (!DOE?.requestPermission) return;
    try {
      const result = await DOE.requestPermission();
      setTiltPermission(result === "granted" ? "granted" : "denied");
    } catch {
      setTiltPermission("denied");
    }
  }

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

      {hovered && isHolo ? (
        <span className="sr-only">Holo shimmer active</span>
      ) : null}

      {gyroEligible && tiltPermission === "needed" ? (
        <button
          type="button"
          onClick={requestTiltPermission}
          className="absolute left-1/2 -translate-x-1/2 -bottom-3 z-20 font-display text-[10px] tracking-wider bg-yellow text-ink border-2 border-ink rounded-sm px-2 py-1 shadow-[2px_2px_0_0_var(--color-ink)] active:translate-y-[1px] active:shadow-[1px_1px_0_0_var(--color-ink)]"
          style={{ transform: "translate(-50%, 0) translateZ(30px)" }}
        >
          Tap to enable tilt
        </button>
      ) : null}
    </div>
  );
}
