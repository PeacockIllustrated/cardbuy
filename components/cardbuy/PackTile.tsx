"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, type CSSProperties } from "react";
import type { CardSet } from "@/lib/types/card";

const TILT_MAX_DEG = 12;
const TILT_LIFT_PX = 14;
const TILT_SCALE = 1.02;
const OPEN_DURATION_MS = 700;

/** Per-set foil palette, hashed off the set id. Each triple is
 *  [wrapper-dark, wrapper-light, foil-stripe]. Picked to read as a
 *  genuine booster wrapper rather than a flat swatch. */
const PALETTES: Array<[string, string, string]> = [
  ["#c41230", "#ff4eb8", "#ffe600"], // crimson · pink · yellow foil
  ["#0e4f9f", "#27d3c4", "#ffffff"], // navy · teal · white foil
  ["#6b2a9f", "#ff4eb8", "#27d3c4"], // purple · pink · teal foil
  ["#0a0a0a", "#ffe600", "#ff4eb8"], // ink · yellow · pink foil
  ["#1d6b2a", "#27d3c4", "#ffe600"], // green · teal · yellow foil
  ["#b14b06", "#ffe600", "#ff4eb8"], // rust · yellow · pink foil
  ["#064f77", "#27d3c4", "#ffe600"], // deep-blue · teal · yellow foil
  ["#8b0e66", "#ff4eb8", "#ffe600"], // magenta · pink · yellow foil
];

function paletteFor(id: string): [string, string, string] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return PALETTES[Math.abs(h) % PALETTES.length];
}

function applyTilt(el: HTMLDivElement, clientX: number, clientY: number) {
  const r = el.getBoundingClientRect();
  const px = (clientX - r.left) / r.width;
  const py = (clientY - r.top) / r.height;
  el.style.setProperty("--mx", `${(px * 100).toFixed(2)}%`);
  el.style.setProperty("--my", `${(py * 100).toFixed(2)}%`);
  el.style.setProperty("--rx", `${((0.5 - py) * TILT_MAX_DEG * 2).toFixed(2)}deg`);
  el.style.setProperty("--ry", `${((px - 0.5) * TILT_MAX_DEG * 2).toFixed(2)}deg`);
  el.style.setProperty("--lift", `${TILT_LIFT_PX}px`);
  el.style.setProperty("--scale", String(TILT_SCALE));
}

function resetTilt(el: HTMLDivElement) {
  el.style.setProperty("--rx", "0deg");
  el.style.setProperty("--ry", "0deg");
  el.style.setProperty("--lift", "0px");
  el.style.setProperty("--scale", "1");
}

type Props = {
  set: CardSet;
  cardCount: number;
  /** Optional size preset — "sm" for dense horizontal rails. */
  size?: "sm" | "md";
};

/**
 * Foil-wrapper pack tile. Built to read as a real sealed booster:
 *   • perforated tear strip up top, pack sealed on first render
 *   • layered foil sheen — static diagonal stripes, rotating conic
 *     iridescence, and a cursor-tracked highlight (via `.card-holo`)
 *   • holographic authenticity sticker pinned bottom-right
 *   • set logo hero-centred on a paper oval, like printed artwork
 *
 * Click plays a multi-stage tear-open animation:
 *   1. tiny jiggle (anticipation)
 *   2. top lid tears off upward with zigzag clip-path
 *   3. pack body tilts back and rises
 *   4. five mini cards burst out from inside, fanning upward
 *   5. bright flash masks the route change
 * Navigation fires after {@link OPEN_DURATION_MS}ms. Users with
 * `prefers-reduced-motion` skip the animation entirely.
 */
export function PackTile({ set, cardCount, size = "md" }: Props) {
  const router = useRouter();
  const outer = useRef<HTMLDivElement | null>(null);
  const navigated = useRef(false);
  const [opening, setOpening] = useState(false);
  const [dark, light, foil] = paletteFor(set.id);

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!outer.current || opening) return;
    applyTilt(outer.current, e.clientX, e.clientY);
  }

  function onMouseLeave() {
    if (!outer.current || opening) return;
    resetTilt(outer.current);
  }

  function onOpen() {
    if (opening || navigated.current) return;
    navigated.current = true;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      router.push(`/search?set=${set.id}`);
      return;
    }
    setOpening(true);
    router.prefetch?.(`/search?set=${set.id}`);
    window.setTimeout(() => {
      router.push(`/search?set=${set.id}`);
    }, OPEN_DURATION_MS);
  }

  const width = size === "sm" ? "w-[130px] md:w-[150px]" : "w-full";

  const faceBg = `linear-gradient(162deg, ${dark} 0%, ${light} 52%, ${dark} 100%)`;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group block ${width} text-left`}
      aria-label={`Open ${set.name} — ${cardCount} cards`}
    >
      <div
        ref={outer}
        className={`pack-tile card-3d relative ${opening ? "pack-opening" : ""}`}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        style={{ "--pack-accent": light } as CSSProperties}
      >
        {/* Cards that burst out during the opening animation. Positioned
            absolutely so they're behind the face at rest; the animation
            flips their z-order via .pack-opening state. */}
        <div aria-hidden className="pack-burst">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className={`pack-burst-card pack-burst-card-${i}`}
              style={{
                background:
                  i === 2
                    ? `linear-gradient(135deg, ${foil} 0%, #fff 45%, ${light} 100%)`
                    : `linear-gradient(135deg, ${light} 0%, ${dark} 100%)`,
              }}
            />
          ))}
        </div>

        {/* THE PACK FACE — animates as a single unit. */}
        <div
          className="card-3d-inner pack-face relative overflow-hidden card-holo"
          style={{
            aspectRatio: "3 / 5",
            background: faceBg,
            boxShadow:
              "3px 3px 0 0 var(--color-ink), inset 0 0 0 3px var(--color-ink)",
          }}
        >
          {/* Wrapper body (below the tear line) */}
          <div className="pack-body absolute inset-0">
            {/* Foil stripe — single diagonal band in the accent */}
            <div
              aria-hidden
              className="absolute inset-x-0 top-[24%] h-[12%] pointer-events-none"
              style={{
                background: `linear-gradient(90deg, transparent 0%, ${foil} 10%, #fff 50%, ${foil} 90%, transparent 100%)`,
                boxShadow:
                  "0 2px 0 0 rgba(10,10,10,0.6), 0 -2px 0 0 rgba(10,10,10,0.6)",
                mixBlendMode: "screen",
                opacity: 0.55,
              }}
            />

            {/* Fine repeating rib — foil texture */}
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none opacity-25 mix-blend-overlay"
              style={{
                background:
                  "repeating-linear-gradient(118deg, rgba(255,255,255,0.5) 0 1px, transparent 1px 9px)",
              }}
            />

            {/* Slow-rotating iridescent wash */}
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none pack-iridescent"
              style={{
                background: `conic-gradient(from 0deg at 50% 50%, ${foil}55 0deg, transparent 50deg, ${light}44 140deg, transparent 220deg, ${foil}55 300deg, transparent 360deg)`,
                mixBlendMode: "color-dodge",
                opacity: 0.55,
              }}
            />

            {/* HERO LOGO OVAL */}
            <div className="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[82%] max-w-[240px]">
              <div
                className="relative aspect-[5/3] border-[3px] border-ink rounded-md overflow-hidden bg-paper-strong"
                style={{ boxShadow: "2px 2px 0 0 rgba(10,10,10,0.75)" }}
              >
                <div
                  aria-hidden
                  className="absolute inset-0 opacity-15"
                  style={{
                    background: `repeating-conic-gradient(from 0deg at 50% 50%, ${dark} 0deg 10deg, transparent 10deg 20deg)`,
                  }}
                />
                {set.logoUrl ? (
                  <Image
                    src={set.logoUrl}
                    alt={`${set.name} logo`}
                    fill
                    sizes="(min-width: 1024px) 200px, 140px"
                    className="object-contain p-2 drop-shadow-[1px_1px_0_rgba(10,10,10,0.4)]"
                    unoptimized
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center font-display text-[14px] md:text-[16px] text-ink text-center px-2">
                    {set.name.toUpperCase()}
                  </div>
                )}
              </div>
            </div>

            {/* BOTTOM PLATE — set name + meta */}
            <div className="pack-bottom-plate absolute bottom-0 left-0 right-0 bg-ink text-paper-strong pt-2 pb-2.5 px-2.5 border-t-[3px] border-ink">
              <div className="font-display text-[11px] md:text-[12.5px] tracking-tight uppercase truncate leading-tight">
                {set.name}
              </div>
              <div className="flex items-center justify-between text-[9px] md:text-[10px] opacity-80 tabular-nums mt-0.5">
                <span>{set.releaseYear}</span>
                <span>{cardCount} cards</span>
              </div>
            </div>

            {/* HOLO STICKER — bottom-right */}
            <div className="pack-sticker absolute bottom-[18%] right-2 w-10 h-10 md:w-11 md:h-11 z-[3]">
              <div
                className="relative w-full h-full rounded-full border-[2px] border-ink overflow-hidden card-holo"
                style={{
                  background: `conic-gradient(from 0deg, ${foil}, ${light}, ${dark}, ${foil})`,
                  boxShadow: "1px 1px 0 0 rgba(10,10,10,0.8)",
                }}
              >
                {set.symbolUrl ? (
                  <Image
                    src={set.symbolUrl}
                    alt=""
                    fill
                    sizes="44px"
                    className="object-contain p-1.5 drop-shadow-[1px_1px_0_rgba(10,10,10,0.8)]"
                    unoptimized
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center font-display text-[14px] text-ink">
                    ★
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* LID — top portion with tear strip + series banner. Breaks
              away during the opening animation. At rest it's seamless
              with the body thanks to matching background. */}
          <div
            className="pack-lid absolute top-0 left-0 right-0"
            style={{
              height: "22%",
              background: faceBg,
            }}
          >
            {/* Lid's own foil rib so it matches the body's texture */}
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none opacity-25 mix-blend-overlay"
              style={{
                background:
                  "repeating-linear-gradient(118deg, rgba(255,255,255,0.5) 0 1px, transparent 1px 9px)",
              }}
            />

            {/* Perforated tear strip */}
            <div className="pack-top-seam absolute top-0 left-0 right-0 h-[32%] bg-ink flex items-center justify-between px-2 text-paper-strong">
              <span
                aria-hidden
                className="absolute inset-0 opacity-35"
                style={{
                  background:
                    "repeating-linear-gradient(90deg, var(--color-paper) 0 3px, transparent 3px 6px)",
                }}
              />
              <span className="relative font-display text-[7px] md:text-[8px] tracking-[0.2em] opacity-85">
                TEAR ▸
              </span>
              <span className="relative font-display text-[7px] md:text-[8px] tracking-[0.2em] opacity-70 tabular-nums">
                {set.id.toUpperCase()}
              </span>
            </div>

            {/* Series banner */}
            <div className="absolute top-[38%] left-0 right-0 flex items-center justify-center px-3">
              <span
                className="font-display text-[8px] md:text-[9px] tracking-[0.25em] text-paper-strong bg-ink px-2 py-0.5 border-[2px] border-ink rotate-[-1.5deg]"
                style={{ boxShadow: "2px 2px 0 0 rgba(255,255,255,0.35)" }}
              >
                {set.series.toUpperCase()}
              </span>
            </div>

            {/* Zigzag bottom edge of the lid — only revealed when torn off */}
            <div className="pack-lid-edge" aria-hidden />
          </div>

          {/* FLASH overlay — brightens briefly at end */}
          <div aria-hidden className="pack-flash" />
        </div>
      </div>
    </button>
  );
}
