"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { CardImage } from "@/components/cardbuy/CardImage";
import { GradedCardScanner } from "@/components/cardbuy/binder/GradedCardScanner";
import { PacksView } from "@/components/cardbuy/binder/PacksView";
import type { BinderPackSummary } from "@/app/_actions/binder";
import {
  addBinderEntry,
  removeBinderEntry,
  setGrail,
  setWishlistTarget,
  toggleWishlist,
} from "@/app/_actions/binder";
import type {
  GradingCompany,
  Grade,
  ItemCondition,
} from "@/lib/supabase/types";

/* ─────────────────────────────────────────────────────────────────
 * Region glossary — mirrors `lib/fixtures/pokedex.ts` REGIONS. Kept
 * client-local so this file can be imported without pulling the
 * server-only fixture module.
 * ───────────────────────────────────────────────────────────────── */
type RegionId =
  | "all"
  | "kanto"
  | "johto"
  | "hoenn"
  | "sinnoh"
  | "unova"
  | "kalos"
  | "alola"
  | "galar"
  | "paldea";

type RegionDef = {
  id: RegionId;
  label: string;
  start: number;
  end: number;
};

/** Top-level binder surface — flips the whole panel between the
 *  dex-by-region view and the packs-by-set view. */
type BinderView = "regions" | "packs";

const REGION_TABS: RegionDef[] = [
  { id: "all",    label: "All",    start: 1,   end: 10000 },
  { id: "kanto",  label: "Kanto",  start: 1,   end: 151 },
  { id: "johto",  label: "Johto",  start: 152, end: 251 },
  { id: "hoenn",  label: "Hoenn",  start: 252, end: 386 },
  { id: "sinnoh", label: "Sinnoh", start: 387, end: 493 },
  { id: "unova",  label: "Unova",  start: 494, end: 649 },
  { id: "kalos",  label: "Kalos",  start: 650, end: 721 },
  { id: "alola",  label: "Alola",  start: 722, end: 809 },
  { id: "galar",  label: "Galar",  start: 810, end: 905 },
  { id: "paldea", label: "Paldea", start: 906, end: 1025 },
];

/* ─────────────────────────────────────────────────────────────────
 * Types — kept client-safe. The server page constructs these from
 * the fixture/dex registry and passes them in as plain data.
 * ───────────────────────────────────────────────────────────────── */

export type BinderOwnedEntry = {
  id: string;
  variant: "raw" | "graded";
  condition?: string;
  grading_company?: string;
  grade?: string;
  quantity: number;
  is_grail?: boolean;
  note?: string;
  acquired_at: string;
  setName: string;
  cardId: string;
};

export type BinderOwnedData = {
  card: {
    id: string;
    name: string;
    imageSmall: string | null;
    setName: string;
    rarity: string | null;
    cardNumber: string;
    hp: string | null;
    types: string[];
    flavorText: string | null;
  };
  entries: BinderOwnedEntry[];
};

/**
 * A card the user owns that doesn't belong in the national Pokédex —
 * Trainer cards, Energy cards, etc. Rendered in the side shelf that
 * peeks out behind the right-hand page of the binder.
 */
export type BinderShelfEntry = {
  id: string;
  cardId: string;
  cardName: string;
  supertype: string; // "Pokémon" | "Trainer" | "Energy"
  subtypes: string[];
  setName: string;
  rarity: string | null;
  imageSmall: string | null;
  variant: "raw" | "graded";
  condition?: string;
  grading_company?: string;
  grade?: string;
  quantity: number;
};

export type BinderShopListing = {
  id: string;
  cardName: string;
  setName: string;
  variantLabel: string;
  priceGbp: number;
  imageSmall: string | null;
  rarity: string | null;
  qtyInStock: number;
  href: string;
};

export type BinderSlotPayload = {
  dexNumber: number;
  dexName: string;
  types: string[];
  owned: BinderOwnedData | null;
  /** Shop listings for this Pokémon (any print / condition). Populated for
   *  both owned AND missing slots — used to fuel the lead-gen panel. */
  shopListings: BinderShopListing[];
  /** Current mock market value for the pokémon (in GBP). Used to seed a
   *  wishlist target-price suggestion for missing slots. */
  marketValueGbp: number | null;
  /** Canonical card_id for the dex-rep print; the wishlist toggle on a
   *  missing slot acts on this id. Null for dex slots with no fixture card
   *  (shouldn't happen in Gen 1 but kept nullable for safety). */
  wishlistCardId: string | null;
  /** Persisted wishlist state read from the DB. UI may show an optimistic
   *  override on top of this. */
  onWishlist: boolean;
  wishlistTargetGbp: number | null;
  /** Small image URL of the canonical dex-rep card. Used on missing
   *  slots as a ghost silhouette so the user can see the shape of the
   *  Pokémon they don't own yet. */
  silhouetteImage: string | null;
};

type Props = {
  /** All dex slot payloads for the full national dex. Client-side
   *  pagination lets the page-flip animation play without a route
   *  change per page. */
  allSlots: BinderSlotPayload[];
  totalOwned: number;
  totalSlots: number;
  initialPageIndex: number;
  userDisplayName: string;
  /** Trainer / Energy / non-Pokémon owned entries, shown on the
   *  side shelf peeking out from behind the right-hand page. */
  shelfEntries?: BinderShelfEntry[];
  /** Pack-level summaries for the alternative "Packs" view. Empty
   *  array means the user has no cards in any known pack. */
  packs?: BinderPackSummary[];
};

const SLOTS_PER_PAGE = 9;

/* ─────────────────────────────────────────────────────────────────
 * Gen-1 energy-type palette — tints type chips in the info panel.
 * Kept local so we don't couple to /components/.../EnergyChip which
 * carries additional styling unrelated to the binder surface.
 * ───────────────────────────────────────────────────────────────── */
const TYPE_COLOR: Record<string, string> = {
  Grass: "bg-[#9fd26a]",
  Fire: "bg-[#ff9a4a]",
  Water: "bg-[#6ec5ff]",
  Lightning: "bg-[#ffe600]",
  Psychic: "bg-[#d38cff]",
  Fighting: "bg-[#d98855]",
  Colorless: "bg-[#efe6d0]",
  Darkness: "bg-[#6b6662]",
  Metal: "bg-[#c4ccd3]",
  Fairy: "bg-[#ff9ed3]",
  Dragon: "bg-[#e2c34b]",
};

/** Standard page-to-page flip within a single filter set. */
type FlipState = {
  dir: "next" | "prev";
  from: number;
  to: number;
  /** When a filter change triggers the flip (region, etc.), the "from"
   *  slots can't be derived from the current filtered array — that
   *  array has already moved to the new filter. snapshotFrom holds the
   *  frozen previous-page content so the outgoing overlay still shows
   *  where the user was. */
  snapshotFrom?: BinderSlotPayload[];
};

export function BinderPanel({
  allSlots,
  initialPageIndex,
  userDisplayName,
  shelfEntries,
  packs = [],
}: Props) {
  // totalOwned + totalSlots are passed by the server page but the
  // panel now derives both from the active region filter — page-level
  // counts would be wrong for Johto / Paldea / etc.
  const [region, setRegion] = useState<RegionId>("all");
  // Top-level surface switch — the regions binder vs. the packs grid.
  const [view, setView] = useState<BinderView>("regions");

  /* ── Filtered slot list — dex numbers inside the active region ── */
  const filteredSlots = useMemo(() => {
    if (region === "all") return allSlots;
    const def = REGION_TABS.find((r) => r.id === region);
    if (!def) return allSlots;
    return allSlots.filter(
      (s) => s.dexNumber >= def.start && s.dexNumber <= def.end,
    );
  }, [allSlots, region]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredSlots.length / SLOTS_PER_PAGE),
  );

  const [pageIndex, setPageIndex] = useState(
    Math.min(Math.max(0, initialPageIndex), Math.max(0, totalPages - 1)),
  );

  const [flip, setFlip] = useState<FlipState | null>(null);

  const [hoveredDex, setHoveredDex] = useState<number | null>(null);
  const [lockedDex, setLockedDex] = useState<number | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);

  /* ── Derived slot pages ─────────────────────────────────────────
   * During a flip, we render two grids simultaneously:
   *   "next" → base shows the incoming page, overlay flips out with old
   *   "prev" → base holds the outgoing page, overlay flips in with new
   * After the animation ends we collapse back to a single page. */
  const basePage =
    flip !== null ? (flip.dir === "next" ? flip.to : flip.from) : pageIndex;
  const overlayPage =
    flip !== null ? (flip.dir === "next" ? flip.from : flip.to) : null;

  const baseSlots = useMemo(
    () => sliceSlots(filteredSlots, basePage),
    [filteredSlots, basePage],
  );
  const overlaySlots = useMemo(() => {
    if (overlayPage === null) return null;
    // Filter changes use snapshotFrom because the filteredSlots array
    // has already been swapped out — slicing it would show the NEW
    // filter's content, not the old one.
    if (flip?.snapshotFrom) return flip.snapshotFrom;
    return sliceSlots(filteredSlots, overlayPage);
  }, [filteredSlots, overlayPage, flip]);

  const activeDex = lockedDex ?? hoveredDex;
  const activeSlot = useMemo(
    () => baseSlots.find((s) => s.dexNumber === activeDex) ?? null,
    [baseSlots, activeDex],
  );

  /* ── Flip trigger & finalisation ───────────────────────────── */
  const startFlip = useCallback(
    (dir: "next" | "prev") => {
      if (flip) return;
      const to = dir === "next" ? pageIndex + 1 : pageIndex - 1;
      if (to < 0 || to >= totalPages) return;

      const reduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (reduced) {
        setPageIndex(to);
        return;
      }

      setHoveredDex(null);
      setFlip({ dir, from: pageIndex, to });
    },
    [flip, pageIndex, totalPages],
  );

  /* ── Region change — trigger the flip with a snapshot ────────── */
  const changeRegion = useCallback(
    (next: RegionId) => {
      if (next === region) return;
      const reduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      // Capture the current page's content BEFORE state change so the
      // outgoing overlay renders with the user's last-seen slots.
      const snapshot = sliceSlots(filteredSlots, pageIndex);
      setHoveredDex(null);
      setLockedDex(null);
      setRegion(next);
      setPageIndex(0);
      if (reduced) return;
      setFlip({ dir: "next", from: 0, to: 0, snapshotFrom: snapshot });
    },
    [region, filteredSlots, pageIndex],
  );

  const handleFlipEnd = useCallback(() => {
    if (!flip) return;
    setPageIndex(flip.to);
    setFlip(null);
  }, [flip]);

  /* ── Click-and-hold fast flip ─────────────────────────────────
   * After the user holds a page-nav button for 500ms, we start cycling
   * pageIndex directly at ~9 pages/sec — no animation per page — to
   * mimic the "riffling" feel of flicking through a physical binder.
   * Releasing stops the cycle; a ref flag suppresses the trailing click
   * so a hold-then-release doesn't also fire startFlip. */
  const fastHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fastCycleInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const suppressNextClick = useRef(false);

  const stopFastCycle = useCallback(() => {
    if (fastHoldTimer.current) {
      clearTimeout(fastHoldTimer.current);
      fastHoldTimer.current = null;
    }
    if (fastCycleInterval.current) {
      clearInterval(fastCycleInterval.current);
      fastCycleInterval.current = null;
    }
  }, []);

  const beginHold = useCallback(
    (dir: "next" | "prev") => {
      stopFastCycle();
      fastHoldTimer.current = setTimeout(() => {
        suppressNextClick.current = true;
        // Kill any in-flight flip animation so the cycle starts clean.
        setFlip(null);
        fastCycleInterval.current = setInterval(() => {
          setPageIndex((cur) => {
            const next = dir === "next" ? cur + 1 : cur - 1;
            if (next < 0 || next >= totalPages) {
              // Hit an edge — stop cycling.
              if (fastCycleInterval.current) {
                clearInterval(fastCycleInterval.current);
                fastCycleInterval.current = null;
              }
              return cur;
            }
            return next;
          });
        }, 110);
      }, 500);
    },
    [stopFastCycle, totalPages],
  );

  // Clean up timers if the component unmounts mid-hold.
  useEffect(() => () => stopFastCycle(), [stopFastCycle]);

  /* ── Keep the URL in sync with pageIndex (bookmarkable) ──────── */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("p", String(pageIndex + 1));
    window.history.replaceState(null, "", url.toString());
  }, [pageIndex]);

  /* ── Click outside the binder → unlock detail panel ──────────── */
  useEffect(() => {
    if (lockedDex === null) return;
    const onDown = (e: MouseEvent) => {
      if (!panelRef.current) return;
      if (!(e.target instanceof Node)) return;
      if (!panelRef.current.contains(e.target)) setLockedDex(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [lockedDex]);

  /* ── Keyboard shortcuts: Esc unlocks, ←/→ flip pages ─────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Escape") {
        setLockedDex(null);
      } else if (e.key === "ArrowRight") {
        startFlip("next");
      } else if (e.key === "ArrowLeft") {
        startFlip("prev");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [startFlip]);

  const handleSlotClick = useCallback((dex: number) => {
    setLockedDex((cur) => (cur === dex ? null : dex));
  }, []);
  const handleSlotEnter = useCallback((dex: number) => {
    setHoveredDex(dex);
  }, []);
  const handleSlotLeave = useCallback(() => {
    setHoveredDex(null);
  }, []);

  // Filtered-view counts so the header reflects the visible region
  // rather than the whole national dex.
  const filteredOwned = useMemo(
    () => filteredSlots.filter((s) => s.owned !== null).length,
    [filteredSlots],
  );
  const filteredTotal = filteredSlots.length;
  const pct = Math.round(
    (filteredOwned / Math.max(1, filteredTotal)) * 100,
  );
  const displayPage = flip ? flip.to : pageIndex;
  // Show actual dex numbers on the current page, not 1-based positions
  // — otherwise "Johto" would read "#001–#009" even though the user is
  // looking at #152–#160.
  const displayedSlots = useMemo(
    () => sliceSlots(filteredSlots, displayPage),
    [filteredSlots, displayPage],
  );
  const rangeStart = displayedSlots[0]?.dexNumber ?? 1;
  const rangeEnd =
    displayedSlots[displayedSlots.length - 1]?.dexNumber ?? rangeStart;

  // Shelf hover state — same contract as the dex grid: hover drives
  // `hoveredShelf`, click toggles `lockedShelf`, the detail pane on
  // the bottom panel reads locked ?? hovered.
  const [hoveredShelf, setHoveredShelf] = useState<string | null>(null);
  const [lockedShelf, setLockedShelf] = useState<string | null>(null);
  const activeShelfId = lockedShelf ?? hoveredShelf;
  const activeShelfEntry = useMemo(
    () =>
      shelfEntries?.find((e) => e.id === activeShelfId) ?? null,
    [shelfEntries, activeShelfId],
  );

  return (
    <div ref={panelRef} className="relative">
      {/* Top-level view switch — flips the whole panel between the
          dex-by-region binder and the packs-by-set surface. */}
      <ViewTabs active={view} onChange={setView} packCount={packs.length} />

      {view === "packs" ? (
        <PacksView packs={packs} />
      ) : (
        <RegionsBinder
          region={region}
          changeRegion={changeRegion}
          flip={flip}
          activeSlot={activeSlot}
          lockedDex={lockedDex}
          filteredOwned={filteredOwned}
          filteredTotal={filteredTotal}
          pct={pct}
          userDisplayName={userDisplayName}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          baseSlots={baseSlots}
          overlaySlots={overlaySlots}
          activeDex={activeDex}
          handleSlotEnter={handleSlotEnter}
          handleSlotLeave={handleSlotLeave}
          handleSlotClick={handleSlotClick}
          handleFlipEnd={handleFlipEnd}
          suppressNextClickRef={suppressNextClick}
          startFlip={startFlip}
          beginHold={beginHold}
          stopFastCycle={stopFastCycle}
          pageIndex={pageIndex}
          totalPages={totalPages}
          displayPage={displayPage}
          shelfEntries={shelfEntries}
          activeShelfId={activeShelfId}
          lockedShelf={lockedShelf}
          activeShelfEntry={activeShelfEntry}
          setHoveredShelf={setHoveredShelf}
          setLockedShelf={setLockedShelf}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
 * View tabs — the very-top control switching between the regions
 * binder and the packs grid. Lighter weight than the region pills:
 * two big buttons with the active one inverted.
 * ───────────────────────────────────────────────────────────────── */

function ViewTabs({
  active,
  onChange,
  packCount,
}: {
  active: BinderView;
  onChange: (next: BinderView) => void;
  packCount: number;
}) {
  return (
    <div className="flex items-stretch gap-1.5 md:gap-2 mb-3 md:mb-4">
      {(
        [
          { id: "regions", label: "Regions" },
          { id: "packs", label: `Packs${packCount > 0 ? ` · ${packCount}` : ""}` },
        ] as const
      ).map((opt) => {
        const isActive = opt.id === active;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            aria-pressed={isActive}
            className={`pop-card rounded-sm px-3 py-1.5 font-display text-[11px] tracking-[0.22em] uppercase transition-[background] duration-150 ${
              isActive
                ? "bg-ink text-paper-strong"
                : "bg-paper-strong text-ink hover:bg-yellow"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
 * RegionsBinder — the existing dex-by-region surface, lifted into
 * its own component so the parent can swap between it and the
 * packs view without disturbing the surrounding state hooks.
 * ───────────────────────────────────────────────────────────────── */

type RegionsBinderProps = {
  region: RegionId;
  changeRegion: (next: RegionId) => void;
  flip: FlipState | null;
  activeSlot: BinderSlotPayload | null;
  lockedDex: number | null;
  filteredOwned: number;
  filteredTotal: number;
  pct: number;
  userDisplayName: string;
  rangeStart: number;
  rangeEnd: number;
  baseSlots: BinderSlotPayload[];
  overlaySlots: BinderSlotPayload[] | null;
  activeDex: number | null;
  handleSlotEnter: (dex: number) => void;
  handleSlotLeave: () => void;
  handleSlotClick: (dex: number) => void;
  handleFlipEnd: () => void;
  suppressNextClickRef: { current: boolean };
  startFlip: (dir: "next" | "prev") => void;
  beginHold: (dir: "next" | "prev") => void;
  stopFastCycle: () => void;
  pageIndex: number;
  totalPages: number;
  displayPage: number;
  shelfEntries?: BinderShelfEntry[];
  activeShelfId: string | null;
  lockedShelf: string | null;
  activeShelfEntry: BinderShelfEntry | null;
  setHoveredShelf: (id: string | null) => void;
  setLockedShelf: (
    update: ((cur: string | null) => string | null),
  ) => void;
};

function RegionsBinder({
  region,
  changeRegion,
  flip,
  activeSlot,
  lockedDex,
  filteredOwned,
  filteredTotal,
  pct,
  userDisplayName,
  rangeStart,
  rangeEnd,
  baseSlots,
  overlaySlots,
  activeDex,
  handleSlotEnter,
  handleSlotLeave,
  handleSlotClick,
  handleFlipEnd,
  suppressNextClickRef,
  startFlip,
  beginHold,
  stopFastCycle,
  pageIndex,
  totalPages,
  displayPage,
  shelfEntries,
  activeShelfId,
  lockedShelf,
  activeShelfEntry,
  setHoveredShelf,
  setLockedShelf,
}: RegionsBinderProps) {
  return (
    <>
      {/* Region glossary — tabs along the top. Clicking a region
          fires the page-turn animation with a snapshot of the current
          page as the outgoing overlay, then jumps to page 0 of the
          new region. */}
      <RegionTabs
        active={region}
        onChange={changeRegion}
        disabled={flip !== null}
      />

      <div className="pop-static rounded-md bg-teal p-2 md:p-2.5 relative z-[1]">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_72px_1.45fr] rounded-sm overflow-hidden border-[2px] border-ink">
          {/* ─── LEFT PAGE · info pane ───────────────────────────── */}
          <section className="relative bg-paper-strong p-4 md:p-6 min-h-[320px] md:min-h-[520px] flex flex-col border-b-[2px] md:border-b-0 border-ink">
            {activeSlot ? (
              <SlotDetails
                slot={activeSlot}
                locked={lockedDex !== null && lockedDex === activeSlot.dexNumber}
              />
            ) : (
              <EmptyState
                totalOwned={filteredOwned}
                totalSlots={filteredTotal}
                pct={pct}
                userDisplayName={userDisplayName}
                regionLabel={
                  region === "all"
                    ? null
                    : REGION_TABS.find((r) => r.id === region)?.label ?? null
                }
              />
            )}
          </section>

          {/* ─── SPINE · rings ───────────────────────────────────── */}
          <div
            className="hidden md:block relative bg-ink/[0.06] border-x-[2px] border-ink"
            aria-hidden
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage:
                  "linear-gradient(to right, rgba(10,10,10,0.1) 0%, rgba(10,10,10,0) 30%, rgba(10,10,10,0) 70%, rgba(10,10,10,0.1) 100%)",
              }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-around py-10">
              {[0, 1, 2, 3].map((i) => (
                <Ring key={i} />
              ))}
            </div>
          </div>

          {/* ─── RIGHT PAGE · 3×3 dex grid + flip stage ──────────── */}
          <section className="relative bg-paper-strong p-4 md:p-5">
            <div className="flex items-baseline justify-between mb-3 md:mb-4 px-1">
              <div
                className="font-display text-[10px] tracking-[0.2em] text-muted tabular-nums"
                aria-live="polite"
              >
                #{String(rangeStart).padStart(3, "0")}–
                {String(rangeEnd).padStart(3, "0")}
              </div>
              <div className="font-display text-[10px] tracking-[0.2em] text-muted tabular-nums">
                {filteredOwned} / {filteredTotal} owned
              </div>
            </div>

            <div
              className={`binder-flip-stage relative ${
                flip ? "binder-flip-locked" : ""
              }`}
            >
              <DexGrid
                slots={baseSlots}
                activeDex={activeDex}
                lockedDex={lockedDex}
                onEnter={handleSlotEnter}
                onLeave={handleSlotLeave}
                onClick={handleSlotClick}
                interactive={flip === null}
              />
              {flip && overlaySlots ? (
                <div
                  className={`binder-flip-overlay bg-paper-strong ${
                    flip.dir === "next" ? "binder-flip-next" : "binder-flip-prev"
                  }`}
                  onAnimationEnd={handleFlipEnd}
                  aria-hidden
                >
                  {/* No inner padding — the overlay must sit flush with
                      the base grid so the overlay's final frame matches
                      pixel-for-pixel and there's no "snap" on unmount. */}
                  <DexGrid
                    slots={overlaySlots}
                    activeDex={null}
                    lockedDex={null}
                    onEnter={noop}
                    onLeave={noop}
                    onClick={noop}
                    interactive={false}
                  />
                </div>
              ) : null}
            </div>

            {/* Page navigation */}
            <div className="mt-5 flex items-center justify-between">
              <PageNavButton
                onClick={() => {
                  if (suppressNextClickRef.current) {
                    suppressNextClickRef.current = false;
                    return;
                  }
                  startFlip("prev");
                }}
                onHoldStart={() => beginHold("prev")}
                onHoldEnd={stopFastCycle}
                disabled={pageIndex <= 0}
                dir="prev"
              />
              <div
                className="font-display text-[11px] tracking-[0.2em] text-muted tabular-nums"
                aria-live="polite"
              >
                Page {displayPage + 1} / {totalPages}
              </div>
              <PageNavButton
                onClick={() => {
                  if (suppressNextClickRef.current) {
                    suppressNextClickRef.current = false;
                    return;
                  }
                  startFlip("next");
                }}
                onHoldStart={() => beginHold("next")}
                onHoldEnd={stopFastCycle}
                disabled={pageIndex >= totalPages - 1}
                dir="next"
              />
            </div>
          </section>
        </div>
      </div>

      {/* Bottom shelf — Trainer / Energy / anything without a dex slot.
          Replaces the old right-edge peek-out with a dedicated panel
          rendered directly below the binder. Has its own two-pane
          layout: a detail pane on the left (fed by shelf-card hover /
          click) mirroring the main binder's info pane, and the shelf
          cards themselves as a horizontal scroll rail on the right. */}
      {shelfEntries && shelfEntries.length > 0 ? (
        <div className="mt-4 md:mt-5">
          <BottomShelfPanel
            entries={shelfEntries}
            activeId={activeShelfId}
            lockedId={lockedShelf}
            onEnter={(id) => setHoveredShelf(id)}
            onLeave={() => setHoveredShelf(null)}
            onClick={(id) =>
              setLockedShelf((cur) => (cur === id ? null : id))
            }
            activeEntry={activeShelfEntry}
          />
        </div>
      ) : null}
    </>
  );
}

function sliceSlots(
  allSlots: BinderSlotPayload[],
  pageIndex: number,
): BinderSlotPayload[] {
  const start = pageIndex * SLOTS_PER_PAGE;
  return allSlots.slice(start, start + SLOTS_PER_PAGE);
}

function noop() {}

/* ─────────────────────────────────────────────────────────────────
 * Region tabs — horizontal scrolling pill bar above the binder.
 * Clicking a tab fires `changeRegion` which triggers the page-flip
 * animation with the old page content captured as the outgoing
 * overlay snapshot.
 * ───────────────────────────────────────────────────────────────── */

function RegionTabs({
  active,
  onChange,
  disabled,
}: {
  active: RegionId;
  onChange: (next: RegionId) => void;
  disabled: boolean;
}) {
  return (
    <nav
      className="flex items-stretch gap-1.5 md:gap-2 overflow-x-auto scrollbar-none -mx-4 md:-mx-0 px-4 md:px-0 mb-3 md:mb-4"
      aria-label="Filter by region"
    >
      {REGION_TABS.map((r) => {
        const isActive = r.id === active;
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => onChange(r.id)}
            disabled={disabled}
            aria-pressed={isActive}
            className={`shrink-0 pop-card rounded-sm px-2.5 py-1 font-display text-[10px] tracking-[0.18em] uppercase transition-[background] duration-150 disabled:opacity-50 ${
              isActive
                ? "bg-ink text-paper-strong"
                : "bg-paper-strong text-ink hover:bg-yellow"
            }`}
          >
            {r.label}
          </button>
        );
      })}
    </nav>
  );
}

/* ─────────────────────────────────────────────────────────────────
 * Bottom shelf panel — Trainer / Energy / anything without a dex
 * slot. Two-pane layout mirroring the main binder: a detail pane on
 * the left driven by shelf-card hover / click, and a horizontal scroll
 * rail of the shelf cards themselves on the right. Same interaction
 * vocabulary as the dex grid.
 * ───────────────────────────────────────────────────────────────── */

const SHELF_SLOTS_PER_PAGE = 9;

function BottomShelfPanel({
  entries,
  activeId,
  lockedId,
  activeEntry,
  onEnter,
  onLeave,
  onClick,
}: {
  entries: BinderShelfEntry[];
  activeId: string | null;
  lockedId: string | null;
  activeEntry: BinderShelfEntry | null;
  onEnter: (id: string) => void;
  onLeave: () => void;
  onClick: (id: string) => void;
}) {
  const energyCount = entries.filter((e) => e.supertype === "Energy").length;
  const trainerCount = entries.filter((e) => e.supertype === "Trainer").length;

  // Client-side pagination mirroring the main binder — 3×3 page, with
  // prev / next controls. No page-flip animation here (the shelf is a
  // secondary surface — page turns would compete with the main
  // binder's flip for attention).
  const totalShelfPages = Math.max(
    1,
    Math.ceil(entries.length / SHELF_SLOTS_PER_PAGE),
  );
  const [shelfPageIndex, setShelfPageIndex] = useState(0);
  // If entries shrink (e.g. user removes a card) clamp the page index
  // back into range on the next render.
  const clampedPageIndex = Math.min(shelfPageIndex, totalShelfPages - 1);
  const pageStart = clampedPageIndex * SHELF_SLOTS_PER_PAGE;
  const pageEntries = entries.slice(
    pageStart,
    pageStart + SHELF_SLOTS_PER_PAGE,
  );
  const fillerCount = SHELF_SLOTS_PER_PAGE - pageEntries.length;

  return (
    /*
     * Visually this is a "mini-binder" — same teal cover, same two-page
     * layout, same ringed spine between the two panes — so it reads as
     * an extension popping out of the bottom rather than a second
     * artefact. Sized ~1/3 the height of the main binder in the grid
     * (info pane fixed height so there's no layout shift when a card
     * is hovered or locked).
     */
    <div className="pop-static rounded-md bg-teal p-2 md:p-2.5 relative">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_72px_1.75fr] rounded-sm overflow-hidden border-[2px] border-ink">
        {/* Detail pane — mirrors the main binder's info pane. Height
            is fixed regardless of selection state so hovering a shelf
            card does NOT push the grid around. */}
        <section className="bg-paper-strong p-4 md:p-5 min-h-[420px] md:min-h-[560px] flex flex-col border-b-[2px] md:border-b-0 border-ink">
          {activeEntry ? (
            <ShelfDetail
              entry={activeEntry}
              locked={lockedId !== null && lockedId === activeEntry.id}
            />
          ) : (
            <div className="flex flex-col gap-1.5">
              <div className="font-display text-[10px] tracking-[0.25em] text-muted">
                Other cards
              </div>
              <h3 className="font-display text-[18px] md:text-[22px] leading-none tracking-tight text-ink">
                Energy &amp; Trainers
              </h3>
              <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-secondary">
                <div>
                  <span className="font-display tabular-nums text-[16px] text-ink">
                    {energyCount}
                  </span>{" "}
                  Energy
                </div>
                <div>
                  <span className="font-display tabular-nums text-[16px] text-ink">
                    {trainerCount}
                  </span>{" "}
                  Trainer
                </div>
              </div>
              <p className="text-[11px] leading-relaxed text-secondary mt-3">
                These don&rsquo;t belong in the Pokédex, but they live
                here. <span className="text-ink/60">Hover</span> a card
                to preview it.{" "}
                <span className="text-ink/60">Click</span> to lock.
              </p>
            </div>
          )}
        </section>

        {/* ─── SPINE · rings — same treatment as the main binder ── */}
        <div
          className="hidden md:block relative bg-ink/[0.06] border-x-[2px] border-ink"
          aria-hidden
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(10,10,10,0.1) 0%, rgba(10,10,10,0) 30%, rgba(10,10,10,0) 70%, rgba(10,10,10,0.1) 100%)",
            }}
          />
          <div className="absolute inset-0 flex flex-col items-center justify-around py-6">
            {[0, 1].map((i) => (
              <Ring key={i} />
            ))}
          </div>
        </div>

        {/* Shelf rail — 3×3 grid of binder-sized cards, exactly like
            the main dex page. Paginated with prev/next arrows. */}
        <section className="bg-paper-strong p-4 md:p-5 flex flex-col">
          <div className="flex items-baseline justify-between mb-3 md:mb-4 px-1">
            <div className="font-display text-[10px] tracking-[0.2em] text-muted tabular-nums">
              {entries.length} cards
            </div>
            <div className="font-display text-[10px] tracking-[0.2em] text-muted tabular-nums">
              Page {clampedPageIndex + 1} / {totalShelfPages}
            </div>
          </div>
          <ul
            className="grid grid-cols-3 gap-3 md:gap-4 flex-1"
            aria-label="Energy and trainer cards"
          >
            {pageEntries.map((entry) => (
              <ShelfRailCard
                key={entry.id}
                entry={entry}
                active={activeId === entry.id}
                locked={lockedId === entry.id}
                onEnter={onEnter}
                onLeave={onLeave}
                onClick={onClick}
              />
            ))}
            {/* Trailing empty card-holder slots — dashed frames that
                make the shelf read as "a binder page with room for
                more" rather than just a grid of whatever happens to
                be owned. Fills the 3×3 so the grid never reflows. */}
            {Array.from({ length: fillerCount }).map((_, i) => (
              <ShelfEmptyHolder key={`empty-${i}`} />
            ))}
          </ul>

          {/* Shelf pagination — deliberately compact (no hold-to-riffle)
              so it doesn't compete with the main binder's controls. */}
          <div className="mt-4 flex items-center justify-between">
            <ShelfNavButton
              dir="prev"
              disabled={clampedPageIndex <= 0}
              onClick={() =>
                setShelfPageIndex((i) => Math.max(0, i - 1))
              }
            />
            <ShelfNavButton
              dir="next"
              disabled={clampedPageIndex >= totalShelfPages - 1}
              onClick={() =>
                setShelfPageIndex((i) =>
                  Math.min(totalShelfPages - 1, i + 1),
                )
              }
            />
          </div>
        </section>
      </div>
    </div>
  );
}

/* Shelf-local nav button — lighter-weight sibling of the main
 * binder's PageNavButton (no hold-to-riffle, no onPointerDown
 * ceremony). The shelf is a secondary surface so the controls are
 * intentionally quiet. */
function ShelfNavButton({
  dir,
  disabled,
  onClick,
}: {
  dir: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  const label = dir === "prev" ? "◀ Prev" : "Next ▶";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "prev" ? "Previous shelf page" : "Next shelf page"}
      className={
        disabled
          ? "pop-card px-3 py-1.5 font-display text-[11px] tracking-wider text-ink/30 cursor-not-allowed rounded-sm"
          : "pop-block rounded-sm bg-paper-strong px-3 py-1.5 font-display text-[11px] tracking-wider text-ink select-none"
      }
    >
      {label}
    </button>
  );
}

function ShelfDetail({
  entry,
  locked,
}: {
  entry: BinderShelfEntry;
  locked: boolean;
}) {
  const variant =
    entry.variant === "graded"
      ? `${entry.grading_company} ${entry.grade}`
      : entry.condition ?? "";
  const supertypeTone =
    entry.supertype === "Energy"
      ? "bg-yellow"
      : entry.supertype === "Trainer"
        ? "bg-pink"
        : "bg-paper";
  return (
    <div className="flex flex-col h-full relative">
      {locked ? (
        <span className="absolute top-0 right-0 pop-card rounded-sm bg-yellow px-2 py-0.5 font-display text-[9px] tracking-[0.2em] text-ink z-10">
          Locked · esc
        </span>
      ) : null}

      <div className="flex flex-col sm:flex-row items-start gap-4">
        {/* Full-size interactive card — same CardImage + tilt behaviour
            as the main Pokédex info pane, so Energy / Trainer cards
            feel every bit as "held" as the owned Pokémon do. */}
        <div className="shrink-0 self-center sm:self-start">
          <CardImage
            src={entry.imageSmall}
            alt={entry.cardName}
            size="md"
            rarity={entry.rarity ?? undefined}
            interactive
            hideBadge
          />
        </div>

        <div className="flex flex-col min-w-0 gap-1.5 flex-1">
          <span
            className={`inline-block self-start border-2 border-ink rounded-sm px-1.5 py-0.5 font-display text-[9px] tracking-[0.2em] uppercase ${supertypeTone}`}
          >
            {entry.supertype}
          </span>
          <div className="font-display text-[18px] md:text-[22px] leading-tight tracking-tight text-ink break-words">
            {entry.cardName}
          </div>
          <div className="text-[11px] text-muted">
            {entry.setName}
            {entry.rarity ? ` · ${entry.rarity}` : ""}
          </div>
          {entry.subtypes.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {entry.subtypes.slice(0, 4).map((st) => (
                <span
                  key={st}
                  className="bg-paper-strong border-2 border-ink rounded-sm px-1.5 py-0.5 font-display text-[9px] tracking-wider"
                >
                  {st}
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-2 pt-2 border-t-2 border-ink/15 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[11px] text-secondary">
            <div>
              <span className="font-display text-[10px] tracking-wider text-muted">
                Qty
              </span>{" "}
              <span className="font-display tabular-nums text-ink">
                ×{entry.quantity}
              </span>
            </div>
            {variant ? (
              <div>
                <span className="font-display text-[10px] tracking-wider text-muted">
                  Variant
                </span>{" "}
                <span className="font-display tracking-wider text-ink">
                  {variant}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function ShelfRailCard({
  entry,
  active,
  locked,
  onEnter,
  onLeave,
  onClick,
}: {
  entry: BinderShelfEntry;
  active: boolean;
  locked: boolean;
  onEnter: (id: string) => void;
  onLeave: () => void;
  onClick: (id: string) => void;
}) {
  const ring = active
    ? locked
      ? "ring-[3px] ring-yellow"
      : "ring-[3px] ring-ink/50"
    : "";
  const supertypeChipBg =
    entry.supertype === "Energy"
      ? "bg-yellow"
      : entry.supertype === "Trainer"
        ? "bg-pink"
        : "bg-paper-strong";
  return (
    <li className="min-w-0">
      <button
        type="button"
        onMouseEnter={() => onEnter(entry.id)}
        onFocus={() => onEnter(entry.id)}
        onMouseLeave={onLeave}
        onBlur={onLeave}
        onClick={() => onClick(entry.id)}
        aria-pressed={locked}
        aria-label={`${entry.cardName}${
          entry.quantity > 1 ? ` × ${entry.quantity}` : ""
        }`}
        /* Grid slot — fills its column (3-col grid) and keeps the
           5:7 card aspect so the slot width exactly matches the main
           dex grid cards at equivalent widths. Dashed frame mirrors
           the main binder's missing-slot card-holder look so the
           shelf reads as a binder page with card sleeves. */
        className={`relative w-full aspect-[5/7] rounded-md text-left transition-shadow border-[2px] border-dashed border-ink/30 bg-paper/60 ${ring}`}
      >
        <div className="relative h-full w-full flex items-center justify-center p-1">
          <CardImage
            src={entry.imageSmall}
            alt={entry.cardName}
            size="sm"
            rarity={entry.rarity ?? undefined}
            interactive
            hideBadge
          />
        </div>
        {/* Supertype sticker top-left — colour-tinted so rows of all
            Energy / all Trainer read at a glance without overloading
            the full card back. */}
        <span
          className={`absolute -top-1 -left-1 z-[4] ${supertypeChipBg} border-2 border-ink px-1.5 py-0.5 font-display text-[9px] tracking-wider rotate-[-4deg] pointer-events-none rounded-sm leading-none`}
        >
          {entry.supertype === "Energy" ? "E" : entry.supertype === "Trainer" ? "T" : "?"}
        </span>
        {entry.quantity > 1 ? (
          <span className="absolute -bottom-1 -right-1 z-[4] bg-teal border-2 border-ink px-1.5 py-0.5 font-display text-[9px] tracking-wider rotate-[3deg] pointer-events-none tabular-nums rounded-sm leading-none">
            ×{entry.quantity}
          </span>
        ) : null}
      </button>
    </li>
  );
}

/* Empty card-holder slot in the shelf rail — same dashed frame as
 * the main binder's missing dex slots. Purely visual, not clickable. */
function ShelfEmptyHolder() {
  return (
    <li
      aria-hidden
      className="w-full aspect-[5/7] rounded-md border-[2px] border-dashed border-ink/20 bg-paper/40"
    />
  );
}

function DexGrid({
  slots,
  activeDex,
  lockedDex,
  onEnter,
  onLeave,
  onClick,
  interactive,
}: {
  slots: BinderSlotPayload[];
  activeDex: number | null;
  lockedDex: number | null;
  onEnter: (dex: number) => void;
  onLeave: () => void;
  onClick: (dex: number) => void;
  interactive: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-3 md:gap-4">
      {slots.map((slot) => (
        <DexSlot
          key={slot.dexNumber}
          slot={slot}
          isLocked={lockedDex === slot.dexNumber}
          isActive={activeDex === slot.dexNumber}
          onEnter={interactive ? onEnter : noop}
          onLeave={interactive ? onLeave : noop}
          onClick={interactive ? onClick : noop}
        />
      ))}
      {Array.from({ length: SLOTS_PER_PAGE - slots.length }).map((_, i) => (
        <div
          key={`filler-${i}`}
          className="aspect-[5/7] rounded-md bg-paper/60 border-[2px] border-ink/10"
          aria-hidden
        />
      ))}
    </div>
  );
}


/* ─────────────────────────────────────────────────────────────────
 * Sub-components
 * ───────────────────────────────────────────────────────────────── */

function Ring() {
  return (
    <div className="relative w-9 h-9">
      <div className="absolute inset-0 rounded-full bg-ink" />
      <div className="absolute inset-[6px] rounded-full bg-paper-strong border-[2px] border-ink" />
      <div className="absolute top-1 left-[30%] w-2 h-1 rounded-full bg-paper-strong/70" />
    </div>
  );
}

function EmptyState({
  totalOwned,
  totalSlots,
  pct,
  userDisplayName,
  regionLabel,
}: {
  totalOwned: number;
  totalSlots: number;
  pct: number;
  userDisplayName: string;
  regionLabel: string | null;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="font-display text-[10px] tracking-[0.25em] text-muted">
        {userDisplayName}&rsquo;s Pokédex
      </div>
      <h2 className="font-display text-[26px] md:text-[32px] leading-[0.95] tracking-tight text-ink mt-1">
        {regionLabel ?? "National Pokédex"}
      </h2>

      <div className="mt-6">
        <div className="flex items-baseline justify-between gap-2">
          <div className="font-display text-[56px] md:text-[68px] leading-none tabular-nums text-ink">
            {totalOwned}
            <span className="text-ink/30">/{totalSlots}</span>
          </div>
          <div className="font-display text-[16px] tracking-wider text-ink/70 tabular-nums">
            {pct}%
          </div>
        </div>
        <div className="mt-3 h-4 border-[3px] border-ink bg-paper rounded-sm overflow-hidden">
          <div
            className="h-full bg-pink border-r-[3px] border-ink"
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
        <div className="mt-2 text-[11px] text-muted uppercase font-display tracking-wider">
          {totalSlots - totalOwned} to go
        </div>
      </div>

      <div className="mt-auto pt-6 border-t-2 border-ink/15">
        <div className="font-display text-[10px] tracking-[0.25em] text-muted mb-2">
          How this works
        </div>
        <p className="text-[12px] leading-relaxed text-secondary">
          Each slot is one Pokémon, in national Pokédex order. <br />
          <span className="text-ink/60">Hover</span> a slot to preview it here.{" "}
          <span className="text-ink/60">Click</span> to lock, so you can read
          details without moving your cursor.
        </p>
      </div>
    </div>
  );
}

function SlotDetails({
  slot,
  locked,
}: {
  slot: BinderSlotPayload;
  locked: boolean;
}) {
  const { dexNumber, dexName, types, owned } = slot;

  return (
    <div className="flex flex-col h-full relative">
      {locked ? (
        <span className="absolute top-0 right-0 pop-card rounded-sm bg-yellow px-2 py-0.5 font-display text-[9px] tracking-[0.2em] text-ink z-10">
          Locked · esc
        </span>
      ) : null}

      <div className="font-display text-[10px] tracking-[0.25em] text-muted tabular-nums">
        #{String(dexNumber).padStart(3, "0")}
      </div>
      <h2 className="font-display text-[26px] md:text-[32px] leading-[0.95] tracking-tight text-ink mt-0.5">
        {dexName}
      </h2>

      {types.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {types.map((t) => (
            <span
              key={t}
              className={`border-2 border-ink rounded-sm px-2 py-0.5 font-display text-[10px] tracking-wider ${TYPE_COLOR[t] ?? "bg-paper"}`}
            >
              {t}
            </span>
          ))}
        </div>
      ) : null}

      {owned ? (
        <OwnedDetails owned={owned} />
      ) : (
        <MissingDetails
          key={slot.wishlistCardId ?? `dex-${slot.dexNumber}`}
          dexName={dexName}
          dexNumber={dexNumber}
          shopListings={slot.shopListings}
          marketValueGbp={slot.marketValueGbp}
          wishlistCardId={slot.wishlistCardId}
          initialOnWishlist={slot.onWishlist}
          initialTargetGbp={slot.wishlistTargetGbp}
          silhouetteImage={slot.silhouetteImage}
        />
      )}
    </div>
  );
}

function OwnedDetails({ owned }: { owned: BinderOwnedData }) {
  const { card, entries } = owned;
  const totalCopies = entries.reduce((a, e) => a + e.quantity, 0);
  const grailEntry = entries.find((e) => e.is_grail) ?? null;
  const hasGrail = grailEntry !== null;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggleGrail = () => {
    setError(null);
    start(async () => {
      try {
        if (hasGrail && grailEntry) {
          await setGrail(grailEntry.id, false);
        } else {
          // No grail set — apply to the first entry (most-recently-first
          // if sorted that way by the server).
          const target = entries[0];
          if (!target) return;
          await setGrail(target.id, true);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to set grail");
      }
    });
  };

  const handleRemove = (entryId: string) => {
    setError(null);
    start(async () => {
      try {
        await removeBinderEntry(entryId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to remove");
      }
    });
  };

  const handleSell = () => {
    // Prefer the grail copy if one exists (users likely want to sell the
    // "best" copy when multiple exist), otherwise the first entry.
    const target = entries.find((e) => e.is_grail) ?? entries[0];
    if (!target) {
      router.push(`/card/${card.id}`);
      return;
    }
    const sp = new URLSearchParams({ prefill_variant: target.variant });
    if (target.variant === "raw" && target.condition) {
      sp.set("prefill_condition", target.condition);
    } else if (target.variant === "graded") {
      if (target.grading_company)
        sp.set("prefill_company", target.grading_company);
      if (target.grade) sp.set("prefill_grade", target.grade);
    }
    router.push(`/card/${card.id}?${sp.toString()}`);
  };

  const handleAdd = (input: AddEntryFormResult) => {
    setError(null);
    start(async () => {
      try {
        await addBinderEntry({
          cardId: card.id,
          variant: input.variant,
          condition: input.condition,
          gradingCompany: input.gradingCompany,
          grade: input.grade,
          quantity: input.quantity,
        });
        setAddOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to add");
      }
    });
  };

  return (
    <>
      {/* Hero card image */}
      <div className="mt-4 flex justify-center">
        <div className="relative">
          <CardImage
            src={card.imageSmall}
            alt={card.name}
            size="md"
            rarity={card.rarity ?? undefined}
            interactive
            hideBadge
          />
          {hasGrail ? (
            <span
              className="absolute -top-2 -right-2 z-[5] w-7 h-7 grid place-items-center rounded-full bg-yellow border-2 border-ink font-display text-[13px]"
              aria-label="Grail"
            >
              ★
            </span>
          ) : null}
        </div>
      </div>

      {/* Meta grid */}
      <div className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] text-secondary">
        <span className="font-display text-[10px] tracking-wider text-muted">
          Set
        </span>
        <span className="text-ink">
          {card.setName} · #{card.cardNumber}
        </span>
        {card.hp ? (
          <>
            <span className="font-display text-[10px] tracking-wider text-muted">
              HP
            </span>
            <span className="text-ink tabular-nums">{card.hp}</span>
          </>
        ) : null}
        {card.rarity ? (
          <>
            <span className="font-display text-[10px] tracking-wider text-muted">
              Rarity
            </span>
            <span className="text-ink">{card.rarity}</span>
          </>
        ) : null}
      </div>

      {card.flavorText ? (
        <p className="mt-4 text-[12px] leading-relaxed italic text-secondary border-l-[3px] border-ink/20 pl-3">
          {card.flavorText}
        </p>
      ) : null}

      {/* Your copies */}
      <div className="mt-5 pt-4 border-t-2 border-ink/15">
        <div className="flex items-baseline justify-between mb-2">
          <div className="font-display text-[10px] tracking-[0.25em] text-muted">
            Your copies
          </div>
          <div className="font-display text-[10px] tracking-wider text-ink/60 tabular-nums">
            ×{totalCopies}
          </div>
        </div>
        <ul className="flex flex-col gap-1.5">
          {entries.map((e) => (
            <li
              key={e.id}
              className="pop-card rounded-sm bg-paper-strong px-2.5 py-1.5 flex items-center gap-2"
            >
              {e.is_grail ? (
                <span
                  className="w-5 h-5 grid place-items-center rounded-full bg-yellow border-2 border-ink font-display text-[10px] shrink-0"
                  title="Grail"
                >
                  ★
                </span>
              ) : null}
              <span className="font-display text-[10px] tracking-wider text-ink">
                {e.variant === "graded"
                  ? `${e.grading_company} ${e.grade}`
                  : e.condition}
              </span>
              <span className="text-[10px] text-muted truncate">
                {e.setName}
              </span>
              {e.quantity > 1 ? (
                <span className="ml-auto font-display text-[10px] tabular-nums text-teal">
                  ×{e.quantity}
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => handleRemove(e.id)}
                disabled={pending}
                className="ml-auto font-display text-[9px] tracking-wider text-ink/50 hover:text-warn underline underline-offset-2 decoration-1 disabled:opacity-40"
                title="Remove this copy"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Action row */}
      <div className="mt-4 pt-4 border-t-2 border-ink/15">
        <div className="flex items-baseline justify-between mb-2">
          <div className="font-display text-[10px] tracking-[0.25em] text-muted">
            Actions
          </div>
          {pending ? (
            <span className="font-display text-[9px] tracking-wider text-ink/50">
              Saving…
            </span>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <ActionButton
            tone="paper"
            icon="+"
            onClick={() => setAddOpen((v) => !v)}
            disabled={pending}
          >
            Add copy
          </ActionButton>
          <ActionButton
            tone="pink"
            icon="◉"
            title="Scan a graded slab with your camera"
            onClick={() => setScannerOpen(true)}
            disabled={pending}
          >
            Scan graded
          </ActionButton>
          <ActionButton
            tone="yellow"
            icon="★"
            onClick={handleToggleGrail}
            disabled={pending || entries.length === 0}
          >
            {hasGrail ? "Unmark Grail" : "Mark Grail"}
          </ActionButton>
          <ActionButton
            tone="teal"
            icon="→"
            onClick={handleSell}
            disabled={pending}
          >
            Sell this card
          </ActionButton>
        </div>

        {addOpen ? (
          <AddEntryForm
            pending={pending}
            existingTuples={entries.map((e) => ({
              variant: e.variant,
              condition: e.condition,
              grading_company: e.grading_company,
              grade: e.grade,
            }))}
            onCancel={() => setAddOpen(false)}
            onSubmit={handleAdd}
          />
        ) : null}

        {error ? (
          <div
            role="alert"
            className="mt-2 text-[11px] text-warn bg-warn/10 border-2 border-warn rounded-sm px-2 py-1"
          >
            {error}
          </div>
        ) : null}
      </div>

      {scannerOpen ? (
        <GradedCardScanner
          cardId={card.id}
          cardName={card.name}
          onClose={() => setScannerOpen(false)}
        />
      ) : null}
    </>
  );
}

function MissingDetails({
  dexName,
  dexNumber,
  shopListings,
  marketValueGbp,
  wishlistCardId,
  initialOnWishlist,
  initialTargetGbp,
  silhouetteImage,
}: {
  dexName: string;
  dexNumber: number;
  shopListings: BinderShopListing[];
  marketValueGbp: number | null;
  wishlistCardId: string | null;
  initialOnWishlist: boolean;
  initialTargetGbp: number | null;
  silhouetteImage: string | null;
}) {
  // Optimistic local state — reverts on server error.
  const [onWishlist, setOnWishlist] = useState(initialOnWishlist);
  const [target, setTarget] = useState(
    initialTargetGbp !== null
      ? String(initialTargetGbp)
      : marketValueGbp
        ? String(Math.round(marketValueGbp * 0.8))
        : "",
  );
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const targetDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // State resets happen automatically because the parent re-keys this
  // component on wishlistCardId — no effect needed.

  const handleToggle = () => {
    if (!wishlistCardId) return;
    setError(null);
    const next = !onWishlist;
    setOnWishlist(next);
    start(async () => {
      try {
        await toggleWishlist(wishlistCardId);
      } catch (e) {
        setOnWishlist(!next);
        setError(e instanceof Error ? e.message : "Failed to update wishlist");
      }
    });
  };

  const handleTargetChange = (value: string) => {
    setTarget(value);
    if (!wishlistCardId || !onWishlist) return;

    if (targetDebounce.current) clearTimeout(targetDebounce.current);
    targetDebounce.current = setTimeout(() => {
      const parsed = value.trim() === "" ? null : Number(value);
      if (parsed !== null && (isNaN(parsed) || parsed < 0)) return;
      start(async () => {
        try {
          await setWishlistTarget(wishlistCardId, parsed);
        } catch (e) {
          setError(
            e instanceof Error ? e.message : "Failed to save target price",
          );
        }
      });
    }, 500);
  };

  // Clean up the debounce timer on unmount.
  useEffect(() => {
    return () => {
      if (targetDebounce.current) clearTimeout(targetDebounce.current);
    };
  }, []);

  return (
    <>
      {/* Ghost card — real card art rendered through a desaturating
          filter so the user can see the shape of the Pokémon they're
          chasing. The interactive CardImage carries the same 3D tilt
          as an owned card, so the "preview" feels alive rather than a
          static placeholder. `#NNN / Missing` chip pinned in the
          corner keeps the not-owned state unambiguous. */}
      <div className="mt-4 flex justify-center">
        <div className="relative">
          <CardImage
            src={silhouetteImage}
            alt={`${dexName} (not owned)`}
            size="md"
            interactive
            hideBadge
            className="[filter:grayscale(1)_brightness(0.55)_contrast(0.85)] opacity-60"
          />
          <span
            className="absolute -top-2 -right-2 z-[5] bg-paper-strong border-2 border-ink px-1.5 py-0.5 font-display text-[9px] tracking-[0.2em] rotate-[3deg] pointer-events-none"
            aria-hidden
          >
            #{String(dexNumber).padStart(3, "0")}
          </span>
          <span
            className="absolute -bottom-2 -left-2 z-[5] bg-ink text-paper-strong border-2 border-ink px-1.5 py-0.5 font-display text-[9px] tracking-[0.2em] -rotate-[3deg] pointer-events-none"
            aria-hidden
          >
            MISSING
          </span>
        </div>
      </div>

      {/* Shop listings — lead-gen engine */}
      <div className="mt-5 pt-4 border-t-2 border-ink/15">
        <div className="flex items-baseline justify-between mb-2">
          <div className="font-display text-[10px] tracking-[0.25em] text-muted">
            On sale now
          </div>
          <div className="font-display text-[10px] tracking-wider text-ink/60 tabular-nums">
            {shopListings.length} listing{shopListings.length === 1 ? "" : "s"}
          </div>
        </div>

        {shopListings.length > 0 ? (
          <>
            <ul className="flex flex-col gap-1.5">
              {shopListings.slice(0, 3).map((l) => (
                <li key={l.id}>
                  <Link
                    href={l.href}
                    className="pop-card rounded-sm bg-paper-strong px-2 py-1.5 flex items-center gap-2 hover:bg-pink/30"
                  >
                    <div className="relative w-8 h-11 shrink-0 rounded-sm border-2 border-ink overflow-hidden bg-paper">
                      {l.imageSmall ? (
                        <Image
                          src={l.imageSmall}
                          alt=""
                          fill
                          sizes="32px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-[10px] tracking-wider text-ink truncate">
                        {l.variantLabel}
                      </div>
                      <div className="text-[10px] text-muted truncate">
                        {l.setName}
                      </div>
                    </div>
                    <div className="font-display text-[13px] tabular-nums text-ink shrink-0">
                      £{l.priceGbp}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href={`/shop?q=${encodeURIComponent(dexName)}`}
              className="mt-2 inline-block font-display text-[10px] tracking-[0.2em] text-ink/70 hover:text-pink underline underline-offset-2 decoration-2"
            >
              See all prints →
            </Link>
          </>
        ) : (
          <div className="pop-card rounded-sm bg-paper px-3 py-3 text-center">
            <div className="font-display text-[11px] tracking-wider text-ink/60">
              Not in stock right now
            </div>
            <div className="text-[10px] text-muted mt-1">
              We&rsquo;ll ping you when one arrives
            </div>
          </div>
        )}
      </div>

      {/* Wishlist + target price */}
      <div className="mt-4 pt-4 border-t-2 border-ink/15">
        <div className="flex items-baseline justify-between mb-2">
          <div className="font-display text-[10px] tracking-[0.25em] text-muted">
            Or plan ahead
          </div>
          {pending ? (
            <span className="font-display text-[9px] tracking-wider text-ink/50">
              Saving…
            </span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={handleToggle}
          disabled={!wishlistCardId || pending}
          className={`w-full pop-block rounded-sm px-3 py-2 font-display text-[11px] tracking-wider text-ink flex items-center justify-between gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
            onWishlist ? "bg-yellow" : "bg-paper-strong"
          }`}
        >
          <span className="flex items-center gap-2">
            <span className="font-display text-[13px]">★</span>
            <span>
              {onWishlist ? "On your wishlist" : "Add to wishlist"}
            </span>
          </span>
          <span className="font-display text-[9px] tracking-[0.2em] text-ink/60">
            {onWishlist ? "ON" : "OFF"}
          </span>
        </button>

        {onWishlist ? (
          <label className="mt-2 flex items-center gap-2 pop-card rounded-sm bg-paper-strong px-2.5 py-1.5">
            <span className="font-display text-[10px] tracking-wider text-muted shrink-0">
              Target
            </span>
            <span className="font-display text-[13px] tabular-nums text-ink">£</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={target}
              onChange={(e) => handleTargetChange(e.target.value)}
              className="flex-1 min-w-0 bg-transparent font-display text-[13px] tabular-nums text-ink focus:outline-none"
              placeholder="0"
            />
            <span className="font-display text-[9px] tracking-[0.2em] text-muted shrink-0">
              or less
            </span>
          </label>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="mt-2 text-[11px] text-warn bg-warn/10 border-2 border-warn rounded-sm px-2 py-1"
          >
            {error}
          </div>
        ) : null}
      </div>
    </>
  );
}

/* Sticker-style action button used across owned + missing panels. */
function ActionButton({
  children,
  tone,
  icon,
  title,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  tone: "paper" | "pink" | "teal" | "yellow";
  icon?: string;
  title?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const bg =
    tone === "pink"
      ? "bg-pink"
      : tone === "teal"
        ? "bg-teal"
        : tone === "yellow"
          ? "bg-yellow"
          : "bg-paper-strong";
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`pop-block rounded-sm px-2.5 py-1.5 font-display text-[11px] tracking-wider text-ink flex items-center gap-2 justify-start ${bg} disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {icon ? (
        <span className="font-display text-[12px] leading-none shrink-0">
          {icon}
        </span>
      ) : null}
      <span className="truncate">{children}</span>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────
 * AddEntryForm — inline drawer for the owned-slot "+ Add copy" action.
 * Variant picker + condition OR grading fields + quantity. Graded dupes
 * ask for a confirm before submitting (per PHASE6_BINDER.md checkpoint 4).
 * ───────────────────────────────────────────────────────────────── */

export type AddEntryFormResult = {
  variant: "raw" | "graded";
  condition?: ItemCondition;
  gradingCompany?: GradingCompany;
  grade?: Grade;
  quantity: number;
};

const CONDITIONS: ItemCondition[] = ["NM", "LP", "MP", "HP", "DMG"];
const GRADING_COMPANIES: GradingCompany[] = ["PSA", "CGC", "BGS", "SGC", "ACE"];
const GRADES: Grade[] = ["10", "9.5", "9", "8.5", "8", "7"];

function AddEntryForm({
  pending,
  existingTuples,
  onCancel,
  onSubmit,
}: {
  pending: boolean;
  existingTuples: Array<{
    variant: "raw" | "graded";
    condition?: string;
    grading_company?: string;
    grade?: string;
  }>;
  onCancel: () => void;
  onSubmit: (result: AddEntryFormResult) => void;
}) {
  const [variant, setVariant] = useState<"raw" | "graded">("raw");
  const [condition, setCondition] = useState<ItemCondition>("NM");
  const [gradingCompany, setGradingCompany] = useState<GradingCompany>("PSA");
  const [grade, setGrade] = useState<Grade>("9");
  const [quantity, setQuantity] = useState(1);
  const [gradedDupeConfirm, setGradedDupeConfirm] = useState(false);

  const dupeExists =
    variant === "graded" &&
    existingTuples.some(
      (t) =>
        t.variant === "graded" &&
        t.grading_company === gradingCompany &&
        t.grade === grade,
    );

  const handleSubmit = () => {
    if (dupeExists && !gradedDupeConfirm) {
      setGradedDupeConfirm(true);
      return;
    }
    onSubmit(
      variant === "raw"
        ? { variant, condition, quantity }
        : { variant, gradingCompany, grade, quantity },
    );
  };

  return (
    <div className="mt-3 pop-static rounded-sm bg-paper p-3 flex flex-col gap-2.5">
      {/* Variant picker */}
      <div className="flex items-center gap-2">
        <span className="font-display text-[10px] tracking-[0.2em] text-muted shrink-0">
          Variant
        </span>
        <div className="flex gap-1">
          {(["raw", "graded"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setVariant(v);
                setGradedDupeConfirm(false);
              }}
              className={`border-2 border-ink rounded-sm px-2 py-0.5 font-display text-[10px] tracking-wider ${
                variant === v ? "bg-yellow" : "bg-paper-strong"
              }`}
            >
              {v === "raw" ? "Raw" : "Graded"}
            </button>
          ))}
        </div>
      </div>

      {/* Condition OR grading fields */}
      {variant === "raw" ? (
        <label className="flex items-center gap-2">
          <span className="font-display text-[10px] tracking-[0.2em] text-muted shrink-0">
            Condition
          </span>
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value as ItemCondition)}
            className="font-display text-[11px] tracking-wider bg-paper-strong border-2 border-ink rounded-sm px-2 py-1"
          >
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-display text-[10px] tracking-[0.2em] text-muted shrink-0">
            Grade
          </span>
          <select
            value={gradingCompany}
            onChange={(e) => {
              setGradingCompany(e.target.value as GradingCompany);
              setGradedDupeConfirm(false);
            }}
            className="font-display text-[11px] tracking-wider bg-paper-strong border-2 border-ink rounded-sm px-2 py-1"
          >
            {GRADING_COMPANIES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <select
            value={grade}
            onChange={(e) => {
              setGrade(e.target.value as Grade);
              setGradedDupeConfirm(false);
            }}
            className="font-display text-[11px] tracking-wider bg-paper-strong border-2 border-ink rounded-sm px-2 py-1"
          >
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Quantity */}
      <label className="flex items-center gap-2">
        <span className="font-display text-[10px] tracking-[0.2em] text-muted shrink-0">
          Qty
        </span>
        <input
          type="number"
          min={1}
          value={quantity}
          onChange={(e) =>
            setQuantity(Math.max(1, Math.floor(Number(e.target.value) || 1)))
          }
          className="w-16 font-display text-[12px] tabular-nums bg-paper-strong border-2 border-ink rounded-sm px-2 py-1"
        />
      </label>

      {/* Graded-duplicate confirmation */}
      {dupeExists && gradedDupeConfirm ? (
        <div className="text-[11px] text-ink bg-yellow border-2 border-ink rounded-sm px-2 py-1.5">
          You already have a {gradingCompany} {grade} copy. Click{" "}
          <strong>Add</strong> again to confirm adding another.
        </div>
      ) : null}

      {/* Buttons */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending}
          className="pop-block rounded-sm bg-teal px-3 py-1 font-display text-[11px] tracking-wider text-ink disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="pop-card rounded-sm bg-paper-strong px-3 py-1 font-display text-[11px] tracking-wider text-ink disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
 * Slot
 * ───────────────────────────────────────────────────────────────── */

function DexSlot({
  slot,
  isLocked,
  isActive,
  onEnter,
  onLeave,
  onClick,
}: {
  slot: BinderSlotPayload;
  isLocked: boolean;
  isActive: boolean;
  onEnter: (dex: number) => void;
  onLeave: () => void;
  onClick: (dex: number) => void;
}) {
  const dexLabel = `#${String(slot.dexNumber).padStart(3, "0")}`;
  const grailed = slot.owned?.entries.some((e) => e.is_grail) ?? false;

  const activeRing = isActive
    ? isLocked
      ? "ring-[3px] ring-yellow"
      : "ring-[3px] ring-ink/50"
    : "";

  return (
    <button
      type="button"
      onMouseEnter={() => onEnter(slot.dexNumber)}
      onFocus={() => onEnter(slot.dexNumber)}
      onMouseLeave={onLeave}
      onBlur={onLeave}
      onClick={() => onClick(slot.dexNumber)}
      className={`relative aspect-[5/7] rounded-md text-left transition-shadow ${activeRing}`}
      aria-label={`Dex ${slot.dexNumber} ${slot.dexName}${slot.owned ? " — owned" : " — missing"}`}
      aria-pressed={isLocked}
    >
      {slot.owned ? (
        <OwnedSlotVisual slot={slot} grailed={grailed} dexLabel={dexLabel} />
      ) : (
        <MissingSlotVisual
          dexLabel={dexLabel}
          name={slot.dexName}
          wishlisted={slot.onWishlist}
        />
      )}
    </button>
  );
}

function OwnedSlotVisual({
  slot,
  grailed,
  dexLabel,
}: {
  slot: BinderSlotPayload;
  grailed: boolean;
  dexLabel: string;
}) {
  const owned = slot.owned!;
  const firstEntry = owned.entries[0];
  const tag =
    firstEntry.variant === "graded"
      ? `${firstEntry.grading_company} ${firstEntry.grade}`
      : firstEntry.condition ?? "";
  const multi = owned.entries.length > 1 || firstEntry.quantity > 1;

  return (
    <>
      <div
        aria-hidden
        className="absolute inset-0 rounded-md bg-paper/40"
        style={{ boxShadow: "inset 0 0 0 2px rgba(10,10,10,0.1)" }}
      />
      <div className="relative h-full w-full flex items-center justify-center p-1">
        <CardImage
          src={owned.card.imageSmall}
          alt={owned.card.name}
          size="sm"
          rarity={owned.card.rarity ?? undefined}
          interactive
          hideBadge
        />
      </div>
      {tag ? (
        <span className="absolute -top-1 -left-1 z-[4] bg-paper-strong border-2 border-ink px-1.5 py-0.5 font-display text-[9px] tracking-wider pointer-events-none rounded-sm">
          {tag}
        </span>
      ) : null}
      {multi ? (
        <span className="absolute -bottom-1 -right-1 z-[4] bg-teal border-2 border-ink px-1.5 py-0.5 font-display text-[9px] tracking-wider pointer-events-none tabular-nums rounded-sm">
          +{owned.entries.length > 1 ? owned.entries.length : firstEntry.quantity}
        </span>
      ) : null}
      {grailed ? (
        <span className="absolute -top-2 -right-2 z-[5] w-6 h-6 grid place-items-center rounded-full bg-yellow border-2 border-ink font-display text-[12px] pointer-events-none">
          ★
        </span>
      ) : null}
      <span className="absolute left-1 bottom-1 z-[4] font-display text-[8.5px] tabular-nums text-ink/55 tracking-wider pointer-events-none">
        {dexLabel}
      </span>
    </>
  );
}

function MissingSlotVisual({
  dexLabel,
  name,
  wishlisted,
}: {
  dexLabel: string;
  name: string;
  wishlisted: boolean;
}) {
  return (
    <div className="absolute inset-0 rounded-md border-[2px] border-dashed border-ink/30 bg-paper/60 overflow-hidden flex flex-col items-center justify-center gap-1">
      <div className="font-display text-[22px] md:text-[26px] tabular-nums text-ink/30 leading-none">
        {dexLabel}
      </div>
      <div className="font-display text-[10px] tracking-wider text-ink/40 uppercase px-1 text-center line-clamp-1">
        {name}
      </div>
      {/* Wishlist heart — pink to differentiate from the gold Grail
          star on owned slots. Positioned INSIDE the slot bounds so it
          can't overlap the +N multi-copy chip on the slot above in
          the grid. */}
      {wishlisted ? (
        <span
          className="absolute top-1 right-1 z-[4] w-5 h-5 grid place-items-center rounded-full bg-pink border-2 border-ink font-display text-[10px] leading-none rotate-[8deg] pointer-events-none"
          aria-label="On wishlist"
        >
          ♥
        </span>
      ) : null}
    </div>
  );
}

function PageNavButton({
  onClick,
  onHoldStart,
  onHoldEnd,
  disabled,
  dir,
}: {
  onClick: () => void;
  onHoldStart: () => void;
  onHoldEnd: () => void;
  disabled: boolean;
  dir: "prev" | "next";
}) {
  const label = dir === "prev" ? "◀ Prev" : "Next ▶";
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={() => {
        if (disabled) return;
        onHoldStart();
      }}
      onPointerUp={onHoldEnd}
      onPointerLeave={onHoldEnd}
      onPointerCancel={onHoldEnd}
      disabled={disabled}
      aria-label={
        dir === "prev"
          ? "Previous page — hold to riffle backward"
          : "Next page — hold to riffle forward"
      }
      className={
        disabled
          ? "pop-card px-3 py-1.5 font-display text-[11px] tracking-wider text-ink/30 cursor-not-allowed rounded-sm"
          : "pop-block rounded-sm bg-paper-strong px-3 py-1.5 font-display text-[11px] tracking-wider text-ink select-none touch-none"
      }
    >
      {label}
    </button>
  );
}

