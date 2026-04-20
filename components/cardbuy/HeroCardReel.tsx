"use client";

import { useEffect, useRef } from "react";
import type { Card } from "@/lib/types/card";
import { CardImage } from "./CardImage";

type Tier = {
  label: string;
  blurb: string;
  /** Rough odds of pulling this tier from a booster. */
  pullRate: string;
  /** Indicative GBP range from Lewis's side of the buylist. */
  priceRange: string;
  /** Notable example Pokémon for this tier. */
  examples: string[];
  /** Backdrop colour behind the stage. */
  bg: string;
  /** Wordmark tint. */
  tint: string;
  /** Accent chip colour for the tier number. */
  chipBg: string;
};

const TIERS: Tier[] = [
  {
    label: "COMMON",
    blurb: "The everyday pull. Bulk cards that build energy decks and first collections.",
    pullRate: "~70% of pulls",
    priceRange: "£0.10 – £0.50",
    examples: ["Pikachu", "Gastly", "Caterpie"],
    bg: "bg-paper-strong",
    tint: "text-muted",
    chipBg: "bg-paper-strong",
  },
  {
    label: "UNCOMMON",
    blurb: "Stage-1 evolutions and key trainers. The backbone of tournament play.",
    pullRate: "~25% of pulls",
    priceRange: "£0.30 – £2",
    examples: ["Haunter", "Machoke", "Ivysaur"],
    bg: "bg-teal",
    tint: "text-ink",
    chipBg: "bg-teal",
  },
  {
    label: "RARE",
    blurb: "Black-star rares. Every booster has one — Stage-2 Pokémon and signature trainers.",
    pullRate: "1 guaranteed per pack",
    priceRange: "£2 – £25",
    examples: ["Beedrill", "Dragonair", "Hitmonlee"],
    bg: "bg-yellow",
    tint: "text-ink",
    chipBg: "bg-yellow",
  },
  {
    label: "RARE HOLO",
    blurb: "Foil fronts, chase-card energy. The look everyone remembers from the schoolyard.",
    pullRate: "~1 in 3 packs",
    priceRange: "£30 – £1000+",
    examples: ["Charizard", "Blastoise", "Mewtwo"],
    bg: "bg-pink",
    tint: "text-ink",
    chipBg: "bg-pink",
  },
  {
    label: "PROMO / CHASE",
    blurb: "Out-of-set legends — event exclusives, movie promos, first-editions. Hunted forever.",
    pullRate: "Event-only",
    priceRange: "£80 – £10,000+",
    examples: ["Ivy Pikachu", "Mew", "No.1 Trainer"],
    bg: "bg-ink",
    tint: "text-yellow",
    chipBg: "bg-ink",
  },
];

type Props = {
  /** Expects exactly five cards in ascending-rarity order. */
  cards: [Card, Card, Card, Card, Card];
};

/**
 * Scroll-driven rarity reel. Pins a sticky stage while the page scrolls
 * through it, progressing an active index 0..4 across five tiered cards.
 *
 * Layout:
 *   • Mobile — card stage centered, big wordmark + blurb below.
 *   • Desktop (≥md) — card stage on the left, detail panel on the
 *     right with wordmark, blurb, pull rate, price band, and example
 *     Pokémon for the active tier.
 *
 * Each card's transform is interpolated from its distance to the active
 * index. The active card also receives `.card-3d-engaged` so holo shimmer
 * + sparkles trigger without hover — crucial on touch devices.
 */
export function HeroCardReel({ cards }: Props) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);
  const stageBgRef = useRef<HTMLDivElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  // Refs for per-tier copy (both mobile-below and desktop-right share these).
  const labelRefs = useRef<(HTMLElement | null)[]>([]);
  const blurbRefs = useRef<(HTMLElement | null)[]>([]);
  const pullRateRef = useRef<HTMLElement | null>(null);
  const priceRangeRef = useRef<HTMLElement | null>(null);
  const examplesRef = useRef<HTMLElement | null>(null);
  const tierIndexRef = useRef<HTMLElement | null>(null);
  const tierChipRef = useRef<HTMLElement | null>(null);

  const lastTierRef = useRef<number>(-1);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    let raf = 0;
    let queued = false;

    const update = () => {
      queued = false;
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const total = Math.max(1, rect.height - vh);
      const scrolled = Math.max(0, -rect.top);
      const p = Math.min(1, Math.max(0, scrolled / total));

      const n = cards.length;
      const activeIdx = p * (n - 1);
      const activeI = Math.min(n - 1, Math.round(activeIdx));

      cardsRef.current.forEach((el, i) => {
        if (!el) return;
        const offset = i - activeIdx;
        const abs = Math.abs(offset);
        const tx = offset * 58;
        const rotY = -offset * 14;
        const rotZ = offset * -2.4;
        const scale = Math.max(0.55, 1.12 - abs * 0.2);
        const opacity = Math.max(0.16, 1 - abs * 0.42);
        const z = 1000 - Math.round(abs * 100);
        el.style.transform =
          `translate(-50%, -50%) translateX(${tx.toFixed(2)}%) ` +
          `rotateY(${rotY.toFixed(2)}deg) rotateZ(${rotZ.toFixed(2)}deg) ` +
          `scale(${scale.toFixed(3)})`;
        el.style.opacity = opacity.toFixed(3);
        el.style.zIndex = String(z);

        const inner = el.querySelector<HTMLElement>(".card-3d");
        if (inner) {
          if (i === activeI) inner.classList.add("card-3d-engaged");
          else inner.classList.remove("card-3d-engaged");
          if (i === activeI) {
            const scrollMix = (p * (n - 1)) - activeI;
            inner.style.setProperty("--rx", `${(scrollMix * 14).toFixed(2)}deg`);
            inner.style.setProperty("--ry", `${(-scrollMix * 18).toFixed(2)}deg`);
            inner.style.setProperty("--lift", `28px`);
            inner.style.setProperty("--scale", `1.04`);
          } else {
            inner.style.setProperty("--rx", `0deg`);
            inner.style.setProperty("--ry", `0deg`);
            inner.style.setProperty("--lift", `0px`);
            inner.style.setProperty("--scale", `1`);
          }
        }
      });

      const bar = progressBarRef.current;
      if (bar) bar.style.transform = `scaleX(${p.toFixed(4)})`;

      if (activeI !== lastTierRef.current) {
        lastTierRef.current = activeI;
        const tier = TIERS[activeI];

        // Wordmark tint swap on both mobile + desktop wordmarks.
        const tintClasses = ["text-muted", "text-ink", "text-yellow"];
        labelRefs.current.forEach((el) => {
          if (!el) return;
          el.textContent = tier.label;
          tintClasses.forEach((c) => el.classList.remove(c));
          el.classList.add(tier.tint);
        });
        blurbRefs.current.forEach((el) => {
          if (!el) return;
          el.textContent = tier.blurb;
        });

        if (pullRateRef.current) pullRateRef.current.textContent = tier.pullRate;
        if (priceRangeRef.current) priceRangeRef.current.textContent = tier.priceRange;
        if (examplesRef.current) examplesRef.current.textContent = tier.examples.join(" · ");
        if (tierIndexRef.current) {
          tierIndexRef.current.textContent = `${activeI + 1} / ${TIERS.length}`;
        }
        if (tierChipRef.current) {
          const chipClasses = ["bg-paper-strong", "bg-teal", "bg-yellow", "bg-pink", "bg-ink"];
          chipClasses.forEach((c) => tierChipRef.current?.classList.remove(c));
          tierChipRef.current.classList.add(tier.chipBg);
          // Flip the chip's text colour against dark bg.
          if (tier.bg === "bg-ink") tierChipRef.current.classList.add("text-yellow");
          else tierChipRef.current.classList.remove("text-yellow");
        }

        const stageBg = stageBgRef.current;
        if (stageBg) {
          const bgClasses = ["bg-paper-strong", "bg-teal", "bg-yellow", "bg-pink", "bg-ink"];
          bgClasses.forEach((c) => stageBg.classList.remove(c));
          stageBg.classList.add(tier.bg);
        }
      }
    };

    const onScroll = () => {
      if (queued) return;
      queued = true;
      raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [cards.length]);

  const tier0 = TIERS[0];

  return (
    <section
      ref={sectionRef}
      className="relative bg-paper px-5 sm:px-10 md:px-14 lg:px-24 py-6 md:py-10"
      style={{ height: "min(260vh, calc(70vh + 5 * 38vh))" }}
      aria-label="Rarity showcase: scroll to rise from common to chase cards"
    >
      <div className="sticky top-[15vh] h-[70vh] overflow-hidden flex flex-col rounded-xl border-[3px] border-ink bg-paper-strong">
        {/* Rarity-tinted backdrop */}
        <div
          ref={stageBgRef}
          className="absolute inset-0 bg-paper-strong transition-colors duration-500 ease-out"
          aria-hidden="true"
        />

        {/* Right-column translucent wash. Lives outside the grid so it
            spans the full height of the sticky (including the header
            strip) — otherwise the tier-tinted backdrop pokes through
            above the aside. Desktop only. */}
        <div
          aria-hidden="true"
          className="hidden md:block absolute top-0 bottom-0 right-0 bg-paper-strong/40 backdrop-blur-[1px] pointer-events-none"
          style={{ left: "calc(1.15 / 2 * 100%)" }}
        />

        {/* Vertical divider that runs the full height of the sticky, so
            the rule between stage + aside reads as one continuous line
            rather than only appearing below the header. Only visible on
            desktop where the two-column layout is active. */}
        <div
          aria-hidden="true"
          className="hidden md:block absolute top-0 bottom-0 w-[3px] bg-ink pointer-events-none z-[5]"
          style={{ left: "calc(1.15 / 2 * 100%)" }}
        />

        {/* Header strip */}
        <div className="relative z-10 flex items-center justify-between px-4 md:px-6 pt-3 md:pt-4">
          <span className="font-display text-[10px] tracking-widest text-ink bg-yellow border-2 border-ink px-2 py-1 rounded-sm">
            The rarity ladder
          </span>
          <span className="font-display text-[10px] tracking-widest text-muted hidden sm:block">
            Scroll ↓
          </span>
        </div>

        {/* Main content — two-up on md+, stacked on mobile */}
        <div className="relative flex-1 grid grid-cols-1 md:grid-cols-[1.15fr_0.85fr] min-h-0">
          {/* Card stage */}
          <div className="relative [perspective:1200px] min-h-0">
            {cards.map((card, i) => (
              <div
                key={card.id}
                ref={(el) => {
                  cardsRef.current[i] = el;
                }}
                className="absolute top-1/2 left-1/2 will-change-transform pointer-events-auto"
                style={{
                  transform: "translate(-50%, -50%)",
                  transition: "transform 140ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 140ms linear",
                }}
              >
                <CardImage
                  src={card.images.large}
                  alt={card.name}
                  size="md"
                  rarity={card.rarity}
                />
                <div className="absolute left-1/2 -bottom-6 -translate-x-1/2 whitespace-nowrap">
                  <span className="font-display text-[9px] tracking-widest bg-ink text-paper-strong px-1.5 py-0.5 rounded-sm border border-ink">
                    {(card.rarity ?? "Promo").toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* DESKTOP info panel — hidden on mobile. A translucent
              paper wash lifts it subtly off the tier backdrop without
              changing the palette wholesale. */}
          <aside className="hidden md:flex relative flex-col justify-center gap-4 px-6 lg:px-10 py-6">
            <div className="flex items-center gap-2">
              <span
                ref={tierChipRef}
                className="font-display text-[10px] tracking-widest border-2 border-ink px-2 py-1 rounded-sm bg-paper-strong"
              >
                RARITY TIER
              </span>
              <span
                ref={tierIndexRef}
                className="font-display text-[10px] tracking-widest text-muted tabular-nums"
              >
                1 / {TIERS.length}
              </span>
            </div>

            <h2 className="font-display leading-[0.9] tracking-tight break-words text-[clamp(32px,_4.5vw,_64px)]">
              <span
                ref={(el) => { labelRefs.current[0] = el; }}
                className="hero-label-strong text-muted transition-colors duration-500 ease-out"
              >
                {tier0.label}
              </span>
            </h2>

            <p
              ref={(el) => { blurbRefs.current[0] = el; }}
              className="text-[13px] lg:text-[14px] text-secondary max-w-[38ch]"
            >
              {tier0.blurb}
            </p>

            <dl className="grid grid-cols-2 gap-3 pt-2 border-t-2 border-ink/15">
              <div className="flex flex-col gap-0.5">
                <dt className="font-display text-[9px] tracking-widest text-muted">
                  PULL RATE
                </dt>
                <dd
                  ref={pullRateRef}
                  className="font-display text-[13px] tracking-tight text-ink"
                >
                  {tier0.pullRate}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="font-display text-[9px] tracking-widest text-muted">
                  BUY RANGE
                </dt>
                <dd
                  ref={priceRangeRef}
                  className="font-display text-[13px] tracking-tight text-ink tabular-nums"
                >
                  {tier0.priceRange}
                </dd>
              </div>
              <div className="col-span-2 flex flex-col gap-0.5">
                <dt className="font-display text-[9px] tracking-widest text-muted">
                  NOTABLE
                </dt>
                <dd
                  ref={examplesRef}
                  className="font-display text-[13px] tracking-tight text-ink"
                >
                  {tier0.examples.join(" · ")}
                </dd>
              </div>
            </dl>
          </aside>
        </div>

        {/* MOBILE wordmark + blurb — hidden on md+ since the panel covers it. */}
        <div className="md:hidden relative z-10 flex flex-col items-center gap-1 px-4 pb-4 text-center">
          <span className="font-display text-[9px] tracking-widest text-muted">
            RARITY TIER
          </span>
          <h2 className="font-display leading-none tracking-tight text-[24px] sm:text-[32px]">
            <span
              ref={(el) => { labelRefs.current[1] = el; }}
              className="hero-label-strong text-muted transition-colors duration-500 ease-out"
            >
              {tier0.label}
            </span>
          </h2>
          <p
            ref={(el) => { blurbRefs.current[1] = el; }}
            className="text-[12px] text-secondary max-w-[48ch] mx-auto"
          >
            {tier0.blurb}
          </p>
        </div>

        {/* Progress bar */}
        <div className="relative z-10 h-[4px] bg-ink/10">
          <div
            ref={progressBarRef}
            className="absolute inset-0 bg-pink origin-left"
            style={{ transform: "scaleX(0)" }}
            aria-hidden="true"
          />
        </div>
      </div>
    </section>
  );
}
