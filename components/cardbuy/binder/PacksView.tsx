"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type CSSProperties,
} from "react";
import { CardImage } from "@/components/cardbuy/CardImage";
import { PackFace, paletteFor } from "@/components/cardbuy/PackTile";
import { getPackCardsForUser } from "@/app/_actions/binder";
import type {
  BinderPackSummary,
  PackCardEntry,
  PackDetailPayload,
} from "@/app/_actions/binder";

/* ─────────────────────────────────────────────────────────────────
 * Packs view — alternative binder surface organised by set rather
 * than by Pokédex region. Two levels:
 *
 *   1. PACK LIST  — 3×3 grid of pack tiles, each shaped like a card
 *                   slot. Left pane shows aggregate stats or the
 *                   hovered / locked pack's details. Click a pack to
 *                   drill into level 2.
 *
 *   2. PACK DETAIL — same binder shell, but the 3×3 grid now shows
 *                   the cards in the selected pack (owned in colour,
 *                   missing as silhouettes). Left pane shows pack
 *                   info or the hovered / locked card. A "back"
 *                   button returns to the pack list.
 *
 * The shell mirrors `BinderPanel` deliberately so the two views feel
 * interchangeable — same teal cover, same ringed spine, same
 * 3D page-flip animation between pages. CSS classes (`binder-flip-*`)
 * are shared with `app/globals.css`.
 * ───────────────────────────────────────────────────────────────── */

type Props = {
  packs: BinderPackSummary[];
};

const SLOTS_PER_PAGE = 9;
/** The pack-list grid uses two rows instead of three so each pack
 *  tile has the headroom to show the whole booster wrapper without
 *  the name + progress bar crowding the bottom plate. */
const PACKS_PER_PAGE = 6;

type FlipState = {
  dir: "next" | "prev";
  from: number;
  to: number;
};

export function PacksView({ packs }: Props) {
  // Drill state — null = browsing the pack list, otherwise viewing
  // the cards inside that pack.
  const [openSetId, setOpenSetId] = useState<string | null>(null);
  const [packDetail, setPackDetail] = useState<PackDetailPayload | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleOpen = useCallback((setId: string) => {
    setOpenSetId(setId);
    setError(null);
    start(async () => {
      try {
        const result = await getPackCardsForUser(setId);
        setPackDetail(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load pack");
      }
    });
  }, []);

  const handleClose = useCallback(() => {
    setOpenSetId(null);
    setPackDetail(null);
    setError(null);
  }, []);

  if (packs.length === 0) {
    return <PacksEmpty />;
  }

  if (openSetId !== null) {
    const summary = packs.find((p) => p.setId === openSetId) ?? null;
    return (
      <PackDetailBinder
        summary={summary}
        detail={packDetail && packDetail.setId === openSetId ? packDetail : null}
        loading={pending}
        error={error}
        onBack={handleClose}
      />
    );
  }

  return <PackListBinder packs={packs} onOpen={handleOpen} />;
}

/* ─────────────────────────────────────────────────────────────────
 * Empty state — the user hasn't added any cards yet, so there are
 * no packs to show. Wrapped in the same teal cover so the surface
 * still reads as "the packs binder" rather than a generic blank.
 * ───────────────────────────────────────────────────────────────── */
function PacksEmpty() {
  return (
    <div className="pop-static rounded-md bg-teal p-2 md:p-2.5">
      <div className="rounded-sm border-[2px] border-ink bg-paper-strong p-8 md:p-12 text-center min-h-[420px] md:min-h-[520px] flex flex-col items-center justify-center">
        <div className="font-display text-[10px] tracking-[0.25em] text-muted">
          Packs
        </div>
        <h2 className="font-display text-[26px] md:text-[32px] leading-[0.95] tracking-tight text-ink mt-1">
          No packs yet
        </h2>
        <p className="mt-3 text-[12px] leading-relaxed text-secondary max-w-md">
          Add a card to your binder and the pack it&rsquo;s from will show up
          here, with a progress bar tracking how much of the set you&rsquo;ve
          collected.
        </p>
        <div className="mt-5">
          <Link
            href="/shop"
            className="pop-block rounded-sm bg-yellow px-3 py-1.5 font-display text-[11px] tracking-[0.2em] uppercase text-ink"
          >
            Browse the shop
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
 * Level 1 — pack list binder.
 *
 * 3×3 grid of pack tiles with the same shell as the regions binder.
 * Hover a pack to preview it on the left pane; click to drill in.
 * ───────────────────────────────────────────────────────────────── */
function PackListBinder({
  packs,
  onOpen,
}: {
  packs: BinderPackSummary[];
  onOpen: (setId: string) => void;
}) {
  const [pageIndex, setPageIndex] = useState(0);
  const [flip, setFlip] = useState<FlipState | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [lockedId, setLockedId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(packs.length / PACKS_PER_PAGE));

  const basePage = flip !== null ? (flip.dir === "next" ? flip.to : flip.from) : pageIndex;
  const overlayPage = flip !== null ? (flip.dir === "next" ? flip.from : flip.to) : null;
  const baseSlots = useMemo(
    () => slicePage(packs, basePage, PACKS_PER_PAGE),
    [packs, basePage],
  );
  const overlaySlots = useMemo(
    () =>
      overlayPage === null ? null : slicePage(packs, overlayPage, PACKS_PER_PAGE),
    [packs, overlayPage],
  );

  const activeId = lockedId ?? hoveredId;
  const activePack = useMemo(
    () => baseSlots.find((p) => p.setId === activeId) ?? null,
    [baseSlots, activeId],
  );

  const startFlip = useCallback(
    (dir: "next" | "prev") => {
      if (flip) return;
      const to = dir === "next" ? pageIndex + 1 : pageIndex - 1;
      if (to < 0 || to >= totalPages) return;
      setHoveredId(null);
      setFlip({ dir, from: pageIndex, to });
    },
    [flip, pageIndex, totalPages],
  );

  const handleFlipEnd = useCallback(() => {
    if (!flip) return;
    setPageIndex(flip.to);
    setFlip(null);
  }, [flip]);

  const startedCount = packs.filter((p) => !p.locked).length;

  const displayPage = flip ? flip.to : pageIndex;
  const displayedSlots = useMemo(
    () => slicePage(packs, displayPage, PACKS_PER_PAGE),
    [packs, displayPage],
  );
  const rangeStart = displayPage * PACKS_PER_PAGE + 1;
  const rangeEnd = rangeStart + displayedSlots.length - 1;

  return (
    <BinderShell
      leftPane={
        activePack ? (
          <PackPreviewPane
            pack={activePack}
            locked={lockedId === activePack.setId}
            onOpen={() => onOpen(activePack.setId)}
          />
        ) : (
          <PacksOverviewPane
            packCount={packs.length}
            startedCount={startedCount}
          />
        )
      }
      rangeLabel={`${rangeStart}–${rangeEnd} of ${packs.length}`}
      rangeRight={`${startedCount} / ${packs.length} started`}
      pageIndex={pageIndex}
      displayPage={displayPage}
      totalPages={totalPages}
      flip={flip}
      onFlipPrev={() => startFlip("prev")}
      onFlipNext={() => startFlip("next")}
      grid={
        <PackGrid
          slots={baseSlots}
          activeId={activeId}
          lockedId={lockedId}
          onEnter={(id) => setHoveredId(id)}
          onLeave={() => setHoveredId(null)}
          onClick={(id) => {
            // Click cycles: lock → unlock → next click drills in.
            // Single click on an unlocked tile locks it (mirrors the
            // dex grid). Double-click drills in. We also expose the
            // explicit "Open pack" button on the left pane.
            setLockedId((cur) => (cur === id ? null : id));
          }}
          onDoubleClick={(id) => onOpen(id)}
          interactive={flip === null}
        />
      }
      overlay={
        flip && overlaySlots ? (
          <PackGrid
            slots={overlaySlots}
            activeId={null}
            lockedId={null}
            onEnter={() => {}}
            onLeave={() => {}}
            onClick={() => {}}
            onDoubleClick={() => {}}
            interactive={false}
          />
        ) : null
      }
      onFlipEnd={handleFlipEnd}
    />
  );
}

function PacksOverviewPane({
  packCount,
  startedCount,
}: {
  packCount: number;
  startedCount: number;
}) {
  const lockedCount = packCount - startedCount;
  // Overview is about *packs*, not *cards* — collectors think in
  // sets-they've-started, and the 18k card denominator across every
  // pack ever printed is a meaningless yardstick on this surface.
  // Card-level progress shows up on the per-pack detail pane.
  const startedPct = Math.round(
    (startedCount / Math.max(1, packCount)) * 100,
  );
  return (
    <div className="flex flex-col h-full">
      <div className="font-display text-[10px] tracking-[0.25em] text-muted">
        Your packs
      </div>

      <div className="mt-3">
        <div className="flex items-baseline justify-between gap-2">
          <div className="font-display text-[56px] md:text-[68px] leading-none tabular-nums text-ink">
            {startedCount}
            <span className="text-ink/30">/{packCount}</span>
          </div>
          <div className="font-display text-[16px] tracking-wider text-ink/70 tabular-nums">
            {startedPct}%
          </div>
        </div>
        <div className="mt-3 h-4 border-[3px] border-ink bg-paper rounded-sm overflow-hidden">
          <div
            className="h-full bg-pink border-r-[3px] border-ink"
            style={{ width: `${Math.min(100, startedPct)}%` }}
          />
        </div>
        <div className="mt-2 text-[11px] text-muted uppercase font-display tracking-wider">
          packs started
        </div>
      </div>

      <div className="mt-auto pt-6 border-t-2 border-ink/15">
        <div className="font-display text-[10px] tracking-[0.25em] text-muted mb-2">
          How this works
        </div>
        <p className="text-[12px] leading-relaxed text-secondary">
          Started packs come first. {lockedCount} locked pack
          {lockedCount === 1 ? "" : "s"} sit{lockedCount === 1 ? "s" : ""} after them — add a card from any
          set to crack one open.{" "}
          <span className="text-ink/60">Hover</span> a tile to preview,{" "}
          <span className="text-ink/60">click</span> to lock,{" "}
          <span className="text-ink/60">double-click</span> to open.
        </p>
      </div>
    </div>
  );
}

function PackPreviewPane({
  pack,
  locked,
  onOpen,
}: {
  pack: BinderPackSummary;
  locked: boolean;
  onOpen: () => void;
}) {
  const pct = Math.round(
    (pack.cardsOwnedDistinct / Math.max(1, pack.printedTotal)) * 100,
  );
  const [dark, light, foil] = paletteFor(pack.setId);
  return (
    <div className="flex flex-col h-full relative">
      {locked ? (
        <span className="absolute top-0 right-0 pop-card rounded-sm bg-yellow px-2 py-0.5 font-display text-[9px] tracking-[0.2em] text-ink z-10">
          Locked · esc
        </span>
      ) : null}

      <div className="font-display text-[10px] tracking-[0.25em] text-muted tabular-nums">
        {pack.releaseYear} · {pack.series}
      </div>
      <h2 className="font-display text-[20px] md:text-[24px] leading-[1.05] tracking-tight text-ink mt-0.5 break-words">
        {pack.setName}
      </h2>

      {/* Hero pack — real booster wrapper, same artwork as the grid
          tile, scaled up. Locked packs render desaturated to reinforce
          "you haven't started this one yet". */}
      <div className="mt-4 flex justify-center">
        <div
          className={`pack-tile card-3d relative w-[140px] md:w-[160px] ${
            pack.locked ? "grayscale opacity-70" : ""
          }`}
          style={{ "--pack-accent": light } as CSSProperties}
        >
          <PackFace
            set={{
              id: pack.setId,
              name: pack.setName,
              series: pack.series,
              releaseYear: pack.releaseYear,
              logoUrl: pack.logoUrl,
              symbolUrl: pack.symbolUrl,
            }}
            cardCount={pack.printedTotal}
            dark={dark}
            light={light}
            foil={foil}
            withBurst={false}
            opening={false}
          />
        </div>
      </div>

      {/* Progress */}
      <div className="mt-5">
        <div className="flex items-baseline justify-between gap-2">
          <div className="font-display text-[36px] md:text-[44px] leading-none tabular-nums text-ink">
            {pack.cardsOwnedDistinct}
            <span className="text-ink/30">/{pack.printedTotal}</span>
          </div>
          <div className="font-display text-[14px] tracking-wider text-ink/70 tabular-nums">
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
          {pack.locked
            ? "not started yet"
            : `${pack.printedTotal - pack.cardsOwnedDistinct} to go${
                pack.copiesTotal > pack.cardsOwnedDistinct
                  ? ` · ${pack.copiesTotal} copies total`
                  : ""
              }`}
        </div>
      </div>

      <div className="mt-auto pt-5">
        <button
          type="button"
          onClick={onOpen}
          className="pop-block rounded-sm bg-yellow w-full px-3 py-2 font-display text-[12px] tracking-[0.22em] uppercase text-ink"
        >
          {pack.locked ? "Browse pack →" : "Open pack →"}
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
 * Pack tile — sized to the same 5:7 card aspect as a dex slot, with
 * the pack logo dominating the upper half and a progress bar across
 * the bottom. Drops the tile into the same 3×3 grid as the regions
 * binder so the surfaces feel physically equivalent.
 * ───────────────────────────────────────────────────────────────── */
function PackGrid({
  slots,
  activeId,
  lockedId,
  onEnter,
  onLeave,
  onClick,
  onDoubleClick,
  interactive,
}: {
  slots: BinderPackSummary[];
  activeId: string | null;
  lockedId: string | null;
  onEnter: (id: string) => void;
  onLeave: () => void;
  onClick: (id: string) => void;
  onDoubleClick: (id: string) => void;
  interactive: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-3 md:gap-4 items-start">
      {slots.map((p) => (
        <BinderPackTile
          key={p.setId}
          pack={p}
          isActive={activeId === p.setId}
          isLocked={lockedId === p.setId}
          onEnter={interactive ? onEnter : () => {}}
          onLeave={interactive ? onLeave : () => {}}
          onClick={interactive ? onClick : () => {}}
          onDoubleClick={interactive ? onDoubleClick : () => {}}
        />
      ))}
      {Array.from({ length: PACKS_PER_PAGE - slots.length }).map((_, i) => (
        <div
          key={`filler-${i}`}
          className="aspect-[3/5] rounded-md bg-paper/60 border-[2px] border-dashed border-ink/15"
          aria-hidden
        />
      ))}
    </div>
  );
}

/**
 * Pack tile in the binder grid — re-uses the same `PackFace` artwork
 * as the sell-side packs (foil wrapper, set logo, holo sticker) so
 * the two surfaces feel like the same physical object. Differences
 * vs. the sell-side `PackTile`:
 *
 *   • No camera-dolly opening overlay — clicks just lock / drill in.
 *   • Locked packs (the user owns zero cards from) render under a
 *     dark scrim with a "locked" stamp, signalling "you haven't
 *     started this one yet".
 *   • Started packs get a progress bar overlaid on the tear-strip
 *     band so completion reads at a glance from the grid.
 */
function BinderPackTile({
  pack,
  isActive,
  isLocked,
  onEnter,
  onLeave,
  onClick,
  onDoubleClick,
}: {
  pack: BinderPackSummary;
  isActive: boolean;
  isLocked: boolean;
  onEnter: (id: string) => void;
  onLeave: () => void;
  onClick: (id: string) => void;
  onDoubleClick: (id: string) => void;
}) {
  const pct = Math.round(
    (pack.cardsOwnedDistinct / Math.max(1, pack.printedTotal)) * 100,
  );
  const [dark, light, foil] = paletteFor(pack.setId);
  const ring = isActive
    ? isLocked
      ? "ring-[3px] ring-yellow"
      : "ring-[3px] ring-ink/40"
    : "";
  const lockedStyle = pack.locked ? "grayscale opacity-70" : "";

  return (
    <button
      type="button"
      onMouseEnter={() => onEnter(pack.setId)}
      onFocus={() => onEnter(pack.setId)}
      onMouseLeave={onLeave}
      onBlur={onLeave}
      onClick={() => onClick(pack.setId)}
      onDoubleClick={() => onDoubleClick(pack.setId)}
      aria-pressed={isLocked}
      aria-label={
        pack.locked
          ? `${pack.setName} — locked, ${pack.printedTotal} cards`
          : `${pack.setName} — ${pack.cardsOwnedDistinct} of ${pack.printedTotal} cards`
      }
      className={`relative flex flex-col gap-2 w-full text-left rounded-sm transition-shadow focus:outline-none ${ring}`}
    >
      {/* Pack art — full booster wrapper, no progress overlay so the
          design reads cleanly. Progress + identifying text sit
          underneath in their own block. */}
      <div className="relative">
        <div
          className={`pack-tile card-3d relative ${lockedStyle}`}
          style={{ "--pack-accent": light } as CSSProperties}
        >
          <PackFace
            set={{
              id: pack.setId,
              name: pack.setName,
              series: pack.series,
              releaseYear: pack.releaseYear,
              logoUrl: pack.logoUrl,
              symbolUrl: pack.symbolUrl,
            }}
            cardCount={pack.printedTotal}
            dark={dark}
            light={light}
            foil={foil}
            withBurst={false}
            opening={false}
          />
        </div>

        {/* Locked stamp sits over the pack art — keeps "not started
            yet" visible without obscuring the set logo behind. */}
        {pack.locked ? (
          <span
            className="absolute z-[5] left-1/2 top-[50%] -translate-x-1/2 -translate-y-1/2 rounded-sm border-[3px] border-ink shadow-[3px_3px_0_0_var(--color-ink)] bg-ink text-paper-strong px-2.5 py-1 font-display text-[10px] tracking-[0.25em] uppercase rotate-[-6deg] pointer-events-none"
            aria-hidden
          >
            Locked
          </span>
        ) : null}
      </div>

      {/* Info block — sits below the pack so the booster artwork
          stays uncluttered and progress reads at full text size. */}
      <div className="flex flex-col gap-1 px-0.5">
        <div className="font-display text-[9px] tracking-[0.18em] text-muted tabular-nums truncate">
          {pack.releaseYear} · {pack.series}
        </div>
        <div className="font-display text-[12px] md:text-[13px] leading-tight tracking-tight text-ink truncate">
          {pack.setName}
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <div className="font-display text-[14px] leading-none tabular-nums text-ink">
            {pack.cardsOwnedDistinct}
            <span className="text-ink/30">/{pack.printedTotal}</span>
          </div>
          <div className="font-display text-[10px] tracking-wider text-ink/70 tabular-nums">
            {pack.locked ? "—" : `${pct}%`}
          </div>
        </div>
        <div className="h-2 border-[2px] border-ink bg-paper rounded-sm overflow-hidden">
          <div
            className="h-full bg-pink"
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      </div>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────
 * Level 2 — pack detail binder.
 *
 * Same shell as the regions binder, but the right grid shows the
 * cards in the selected pack (owned in colour, missing as
 * silhouettes) and the left pane shows pack info or the
 * hovered / locked card. A "back" button returns to the pack list.
 * ───────────────────────────────────────────────────────────────── */
function PackDetailBinder({
  summary,
  detail,
  loading,
  error,
  onBack,
}: {
  summary: BinderPackSummary | null;
  detail: PackDetailPayload | null;
  loading: boolean;
  error: string | null;
  onBack: () => void;
}) {
  return (
    <div>
      {/* Crumb / back row — sits above the binder cover so the cover
          itself stays visually identical to the regions binder. */}
      <div className="mb-3 md:mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="pop-card rounded-sm bg-paper-strong px-2.5 py-1 font-display text-[10px] tracking-[0.2em] uppercase text-ink hover:bg-yellow"
        >
          ← All packs
        </button>
        {summary ? (
          <div className="font-display text-[10px] tracking-[0.18em] text-muted truncate">
            {summary.releaseYear} · {summary.series} · {summary.setName}
          </div>
        ) : null}
      </div>

      {loading && !detail ? (
        <div className="pop-static rounded-md bg-teal p-2 md:p-2.5">
          <div className="rounded-sm border-[2px] border-ink bg-paper-strong p-12 text-center min-h-[420px] md:min-h-[520px] flex items-center justify-center">
            <div className="font-display text-[11px] tracking-[0.25em] uppercase text-muted">
              Loading pack&hellip;
            </div>
          </div>
        </div>
      ) : error ? (
        <div className="pop-static rounded-md bg-teal p-2 md:p-2.5">
          <div className="rounded-sm border-[2px] border-ink bg-paper-strong p-12 text-center min-h-[300px] flex items-center justify-center">
            <div className="inline-block pop-card rounded-sm bg-pink px-3 py-2 font-display text-[11px] tracking-[0.2em] uppercase text-ink">
              {error}
            </div>
          </div>
        </div>
      ) : detail ? (
        <PackDetailBody
          key={detail.setId}
          summary={summary}
          detail={detail}
          onBack={onBack}
        />
      ) : null}
    </div>
  );
}

function PackDetailBody({
  summary,
  detail,
  onBack,
}: {
  summary: BinderPackSummary | null;
  detail: PackDetailPayload;
  onBack: () => void;
}) {
  const [pageIndex, setPageIndex] = useState(0);
  const [flip, setFlip] = useState<FlipState | null>(null);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [lockedCardId, setLockedCardId] = useState<string | null>(null);

  const cards = detail.cards;
  const totalPages = Math.max(1, Math.ceil(cards.length / SLOTS_PER_PAGE));

  const basePage = flip !== null ? (flip.dir === "next" ? flip.to : flip.from) : pageIndex;
  const overlayPage = flip !== null ? (flip.dir === "next" ? flip.from : flip.to) : null;
  const baseSlots = useMemo(
    () => slicePage(cards, basePage, SLOTS_PER_PAGE),
    [cards, basePage],
  );
  const overlaySlots = useMemo(
    () =>
      overlayPage === null ? null : slicePage(cards, overlayPage, SLOTS_PER_PAGE),
    [cards, overlayPage],
  );

  const activeCardId = lockedCardId ?? hoveredCardId;
  const activeCard = useMemo(
    () => baseSlots.find((c) => c.id === activeCardId) ?? null,
    [baseSlots, activeCardId],
  );

  const startFlip = useCallback(
    (dir: "next" | "prev") => {
      if (flip) return;
      const to = dir === "next" ? pageIndex + 1 : pageIndex - 1;
      if (to < 0 || to >= totalPages) return;
      setHoveredCardId(null);
      setFlip({ dir, from: pageIndex, to });
    },
    [flip, pageIndex, totalPages],
  );

  const handleFlipEnd = useCallback(() => {
    if (!flip) return;
    setPageIndex(flip.to);
    setFlip(null);
  }, [flip]);

  // Esc unlocks the active card OR (if nothing is locked) returns
  // to the pack list. Mirrors the regions binder's Esc behaviour
  // so both surfaces feel consistent.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Escape") {
        if (lockedCardId !== null) setLockedCardId(null);
        else onBack();
      } else if (e.key === "ArrowRight") {
        startFlip("next");
      } else if (e.key === "ArrowLeft") {
        startFlip("prev");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lockedCardId, onBack, startFlip]);

  const ownedCount = cards.filter((c) => c.owned).length;
  const printedTotal = summary?.printedTotal ?? cards.length;
  const pct = Math.round((ownedCount / Math.max(1, printedTotal)) * 100);

  const displayPage = flip ? flip.to : pageIndex;
  const pageCardsForRange = useMemo(
    () => slicePage(cards, displayPage, SLOTS_PER_PAGE),
    [cards, displayPage],
  );
  const rangeStart = pageCardsForRange[0]?.number ?? "—";
  const rangeEnd = pageCardsForRange[pageCardsForRange.length - 1]?.number ?? rangeStart;

  return (
    <BinderShell
      leftPane={
        activeCard ? (
          <PackCardDetailPane card={activeCard} locked={lockedCardId === activeCard.id} />
        ) : (
          <PackHeaderPane
            summary={summary}
            detail={detail}
            ownedCount={ownedCount}
            printedTotal={printedTotal}
            pct={pct}
          />
        )
      }
      rangeLabel={`#${rangeStart}–#${rangeEnd}`}
      rangeRight={`${ownedCount} / ${printedTotal} owned`}
      pageIndex={pageIndex}
      displayPage={displayPage}
      totalPages={totalPages}
      flip={flip}
      onFlipPrev={() => startFlip("prev")}
      onFlipNext={() => startFlip("next")}
      grid={
        <PackCardGrid
          slots={baseSlots}
          activeId={activeCardId}
          lockedId={lockedCardId}
          onEnter={(id) => setHoveredCardId(id)}
          onLeave={() => setHoveredCardId(null)}
          onClick={(id) =>
            setLockedCardId((cur) => (cur === id ? null : id))
          }
          interactive={flip === null}
        />
      }
      overlay={
        flip && overlaySlots ? (
          <PackCardGrid
            slots={overlaySlots}
            activeId={null}
            lockedId={null}
            onEnter={() => {}}
            onLeave={() => {}}
            onClick={() => {}}
            interactive={false}
          />
        ) : null
      }
      onFlipEnd={handleFlipEnd}
    />
  );
}

function PackHeaderPane({
  summary,
  detail,
  ownedCount,
  printedTotal,
  pct,
}: {
  summary: BinderPackSummary | null;
  detail: PackDetailPayload;
  ownedCount: number;
  printedTotal: number;
  pct: number;
}) {
  const [dark, light, foil] = paletteFor(detail.setId);
  return (
    <div className="flex flex-col h-full">
      <div className="font-display text-[10px] tracking-[0.25em] text-muted">
        {detail.releaseYear} · {detail.series}
      </div>
      <h2 className="font-display text-[20px] md:text-[24px] leading-[1.05] tracking-tight text-ink mt-1 break-words">
        {detail.setName}
      </h2>

      <div className="mt-4 flex justify-center">
        <div
          className="pack-tile card-3d relative w-[120px] md:w-[140px]"
          style={{ "--pack-accent": light } as CSSProperties}
        >
          <PackFace
            set={{
              id: detail.setId,
              name: detail.setName,
              series: detail.series,
              releaseYear: detail.releaseYear,
              logoUrl: summary?.logoUrl ?? null,
              symbolUrl: summary?.symbolUrl ?? null,
            }}
            cardCount={printedTotal}
            dark={dark}
            light={light}
            foil={foil}
            withBurst={false}
            opening={false}
          />
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-baseline justify-between gap-2">
          <div className="font-display text-[44px] md:text-[56px] leading-none tabular-nums text-ink">
            {ownedCount}
            <span className="text-ink/30">/{printedTotal}</span>
          </div>
          <div className="font-display text-[14px] tracking-wider text-ink/70 tabular-nums">
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
          {printedTotal - ownedCount} to go
        </div>
      </div>

      <div className="mt-auto pt-5 border-t-2 border-ink/15">
        <p className="text-[12px] leading-relaxed text-secondary">
          <span className="text-ink/60">Hover</span> a card to preview it here.{" "}
          <span className="text-ink/60">Click</span> to lock,{" "}
          <span className="text-ink/60">esc</span> to back out.
        </p>
      </div>
    </div>
  );
}

function PackCardDetailPane({
  card,
  locked,
}: {
  card: PackCardEntry;
  locked: boolean;
}) {
  return (
    <div className="flex flex-col h-full relative">
      {locked ? (
        <span className="absolute top-0 right-0 pop-card rounded-sm bg-yellow px-2 py-0.5 font-display text-[9px] tracking-[0.2em] text-ink z-10">
          Locked · esc
        </span>
      ) : null}

      <div className="font-display text-[10px] tracking-[0.25em] text-muted tabular-nums">
        #{card.number}
      </div>
      <h2 className="font-display text-[20px] md:text-[24px] leading-[1.05] tracking-tight text-ink mt-0.5 break-words">
        {card.name}
      </h2>

      <div className="mt-4 flex justify-center">
        <div className={card.owned ? "" : "opacity-40 grayscale"}>
          <CardImage
            src={card.imageSmall}
            alt={card.name}
            size="md"
            rarity={card.rarity ?? undefined}
            interactive
            hideBadge
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] text-secondary">
        <span className="font-display text-[10px] tracking-wider text-muted">Status</span>
        <span className={`font-display text-[11px] tracking-wider ${card.owned ? "text-ink" : "text-muted"}`}>
          {card.owned
            ? card.quantity > 1
              ? `OWNED · ×${card.quantity}`
              : "OWNED"
            : "MISSING"}
        </span>
        {card.rarity ? (
          <>
            <span className="font-display text-[10px] tracking-wider text-muted">Rarity</span>
            <span className="text-ink">{card.rarity}</span>
          </>
        ) : null}
        <span className="font-display text-[10px] tracking-wider text-muted">Type</span>
        <span className="text-ink">{card.supertype}</span>
        {card.owned && card.variants.length > 0 ? (
          <>
            <span className="font-display text-[10px] tracking-wider text-muted">Variants</span>
            <span className="text-ink uppercase font-display tracking-wider text-[11px]">
              {card.variants.join(" · ")}
            </span>
          </>
        ) : null}
      </div>

      <div className="mt-auto pt-5 flex flex-col gap-2">
        <Link
          href={`/card/${card.id}`}
          className="pop-block rounded-sm bg-yellow w-full px-3 py-2 text-center font-display text-[12px] tracking-[0.22em] uppercase text-ink"
        >
          View card →
        </Link>
        {!card.owned ? (
          <div className="text-[11px] text-muted text-center">
            Add it from the card page to fill this slot.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PackCardGrid({
  slots,
  activeId,
  lockedId,
  onEnter,
  onLeave,
  onClick,
  interactive,
}: {
  slots: PackCardEntry[];
  activeId: string | null;
  lockedId: string | null;
  onEnter: (id: string) => void;
  onLeave: () => void;
  onClick: (id: string) => void;
  interactive: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-3 md:gap-4">
      {slots.map((c) => (
        <PackCardSlot
          key={c.id}
          card={c}
          isActive={activeId === c.id}
          isLocked={lockedId === c.id}
          onEnter={interactive ? onEnter : () => {}}
          onLeave={interactive ? onLeave : () => {}}
          onClick={interactive ? onClick : () => {}}
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

function PackCardSlot({
  card,
  isActive,
  isLocked,
  onEnter,
  onLeave,
  onClick,
}: {
  card: PackCardEntry;
  isActive: boolean;
  isLocked: boolean;
  onEnter: (id: string) => void;
  onLeave: () => void;
  onClick: (id: string) => void;
}) {
  const ring = isActive
    ? isLocked
      ? "ring-[3px] ring-yellow"
      : "ring-[3px] ring-ink/40"
    : "";
  return (
    <button
      type="button"
      onMouseEnter={() => onEnter(card.id)}
      onFocus={() => onEnter(card.id)}
      onMouseLeave={onLeave}
      onBlur={onLeave}
      onClick={() => onClick(card.id)}
      aria-pressed={isLocked}
      aria-label={`${card.name} #${card.number}${card.owned ? "" : " — missing"}`}
      className={`relative w-full aspect-[5/7] rounded-md p-1 ${
        card.owned
          ? "bg-paper-strong border-[2px] border-ink/20"
          : "bg-paper/40 border-[2px] border-dashed border-ink/30"
      } ${ring}`}
    >
      <div className={`relative h-full w-full ${card.owned ? "" : "opacity-30 grayscale"}`}>
        <CardImage
          src={card.imageSmall}
          alt={card.name}
          size="sm"
          rarity={card.rarity ?? undefined}
          interactive={false}
          hideBadge
        />
      </div>
      <span className="absolute top-1 left-1 z-[4] bg-paper-strong/90 border border-ink/40 px-1 py-0.5 font-display text-[8px] tracking-wider tabular-nums leading-none rounded-sm pointer-events-none">
        #{card.number}
      </span>
      {card.owned && card.quantity > 1 ? (
        <span className="absolute -bottom-1 -right-1 z-[4] bg-teal border-2 border-ink px-1.5 py-0.5 font-display text-[9px] tracking-wider rotate-[3deg] pointer-events-none tabular-nums rounded-sm leading-none">
          ×{card.quantity}
        </span>
      ) : null}
      {!card.owned ? (
        <span className="absolute -top-1 -left-1 z-[4] bg-paper-strong border-2 border-ink px-1.5 py-0.5 font-display text-[8px] tracking-wider rotate-[-4deg] pointer-events-none rounded-sm leading-none uppercase">
          Need
        </span>
      ) : null}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────
 * BinderShell — the teal-cover, two-page, ringed-spine layout that
 * both the pack list and pack detail share. Mirrors the regions
 * binder's shell exactly (same paddings, same border weights, same
 * spine width) so the two views feel like the same physical binder.
 * ───────────────────────────────────────────────────────────────── */
function BinderShell({
  leftPane,
  grid,
  overlay,
  onFlipEnd,
  flip,
  rangeLabel,
  rangeRight,
  pageIndex,
  displayPage,
  totalPages,
  onFlipPrev,
  onFlipNext,
}: {
  leftPane: React.ReactNode;
  grid: React.ReactNode;
  overlay: React.ReactNode | null;
  onFlipEnd: () => void;
  flip: FlipState | null;
  rangeLabel: string;
  rangeRight: string;
  pageIndex: number;
  displayPage: number;
  totalPages: number;
  onFlipPrev: () => void;
  onFlipNext: () => void;
}) {
  return (
    <div className="pop-static rounded-md bg-teal p-2 md:p-2.5 relative z-[1]">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_72px_1.45fr] rounded-sm overflow-hidden border-[2px] border-ink">
        {/* ─── LEFT PAGE · info pane ───────────────────────────── */}
        {/* `min-w-0` keeps this column locked to its grid allocation —
            without it, an unbroken word in the heading (a long set
            name) would force the column wider, pushing content over
            the spine into the right page. */}
        <section className="relative bg-paper-strong p-4 md:p-6 min-h-[320px] md:min-h-[520px] flex flex-col border-b-[2px] md:border-b-0 border-ink min-w-0">
          {leftPane}
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

        {/* ─── RIGHT PAGE · 3×3 grid + flip stage ──────────────── */}
        <section className="relative bg-paper-strong p-4 md:p-5">
          <div className="flex items-baseline justify-between mb-3 md:mb-4 px-1">
            <div
              className="font-display text-[10px] tracking-[0.2em] text-muted tabular-nums"
              aria-live="polite"
            >
              {rangeLabel}
            </div>
            <div className="font-display text-[10px] tracking-[0.2em] text-muted tabular-nums">
              {rangeRight}
            </div>
          </div>

          <div
            className={`binder-flip-stage relative ${flip ? "binder-flip-locked" : ""}`}
          >
            {grid}
            {flip && overlay ? (
              <div
                className={`binder-flip-overlay bg-paper-strong ${
                  flip.dir === "next" ? "binder-flip-next" : "binder-flip-prev"
                }`}
                onAnimationEnd={onFlipEnd}
                aria-hidden
              >
                {overlay}
              </div>
            ) : null}
          </div>

          <div className="mt-5 flex items-center justify-between">
            <ShellNavButton dir="prev" onClick={onFlipPrev} disabled={pageIndex <= 0} />
            <div
              className="font-display text-[11px] tracking-[0.2em] text-muted tabular-nums"
              aria-live="polite"
            >
              Page {displayPage + 1} / {totalPages}
            </div>
            <ShellNavButton
              dir="next"
              onClick={onFlipNext}
              disabled={pageIndex >= totalPages - 1}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function ShellNavButton({
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
      aria-label={dir === "prev" ? "Previous page" : "Next page"}
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

function Ring() {
  return (
    <div className="relative w-9 h-9">
      <div className="absolute inset-0 rounded-full bg-ink" />
      <div className="absolute inset-[6px] rounded-full bg-paper-strong border-[2px] border-ink" />
      <div className="absolute top-1 left-[30%] w-2 h-1 rounded-full bg-paper-strong/70" />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
 * Pure helpers
 * ───────────────────────────────────────────────────────────────── */
function slicePage<T>(items: T[], pageIndex: number, perPage: number): T[] {
  const start = pageIndex * perPage;
  return items.slice(start, start + perPage);
}
