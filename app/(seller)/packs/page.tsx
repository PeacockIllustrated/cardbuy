import Link from "next/link";
import { PackTile } from "@/components/cardbuy/PackTile";
import { PacksChipNav } from "@/components/cardbuy/PacksChipNav";
import {
  getSetsGroupedBySeries,
  getCardCount,
  getAllCards,
} from "@/lib/fixtures/cards";

export const metadata = {
  title: "Pick a pack · cardbuy",
  description:
    "Tear open any set. Every pack from Base Set to current — tap one to see every card inside and what we'll pay.",
};

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function PacksPage() {
  // Newest series first — modern-era sellers most common; nostalgia
  // (Base/Gym/Neo) lives further down.
  const grouped = [...getSetsGroupedBySeries()].reverse();
  const totalSets = grouped.reduce((n, g) => n + g.sets.length, 0);
  const totalCards = getAllCards().length;
  const seriesList = grouped.map((g) => g.series);

  return (
    <main className="bg-paper">
      {/* COMPACT HERO — half the height of the previous hero so the
          packs start above the fold on a laptop. */}
      <section className="border-b-[3px] border-ink bg-yellow relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(var(--color-ink) 1.2px, transparent 1.2px)",
            backgroundSize: "14px 14px",
          }}
        />
        <div className="relative max-w-[1300px] mx-auto px-4 md:px-6 py-6 md:py-8 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <span className="font-display text-[10px] md:text-[11px] tracking-[0.25em] bg-ink text-paper-strong px-2 py-1 w-fit rounded-sm inline-block mb-2">
              SELL TO US · STEP 1
            </span>
            <h1 className="font-display text-[28px] md:text-[44px] leading-[0.92] tracking-tight">
              Pick a pack.
            </h1>
            <p className="mt-1 max-w-[60ch] text-[12.5px] md:text-[13.5px] leading-snug">
              Tear one open to see every card inside and what we&apos;ll pay.{" "}
              <span className="font-display tabular-nums">
                {totalSets}
              </span>{" "}
              packs ·{" "}
              <span className="font-display tabular-nums">
                {totalCards.toLocaleString()}
              </span>{" "}
              cards.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Link
              href="/search"
              className="pop-block inline-flex items-center justify-center bg-paper-strong text-ink px-3 py-1.5 font-display text-[11px] tracking-wider uppercase rounded-md"
            >
              Search by name →
            </Link>
            <Link
              href="/submission"
              className="inline-flex items-center justify-center border-2 border-ink bg-paper-strong text-ink px-3 py-1.5 font-display text-[11px] tracking-wider uppercase rounded-md hover:bg-teal"
            >
              My submission
            </Link>
          </div>
        </div>
      </section>

      {/* Sticky series chip nav */}
      <PacksChipNav series={seriesList} />

      {/* Horizontal rails — one row per series, dense snap-scroll.
          Keeps the full 17-series view to roughly a single viewport on
          desktop instead of the previous stacked-grid that stretched
          for thousands of pixels. */}
      <div className="max-w-[1300px] mx-auto px-4 md:px-6 py-2">
        {grouped.map(({ series, sets }) => {
          const cardTotal = sets.reduce((n, s) => n + getCardCount(s.id), 0);
          return (
            <section
              key={series}
              id={`series-${slug(series)}`}
              className="py-5 md:py-7 border-b-2 border-rule last:border-b-0"
            >
              <header className="flex items-baseline justify-between gap-4 mb-3">
                <h2 className="font-display text-[18px] md:text-[22px] tracking-tight uppercase">
                  {series}
                </h2>
                <div className="text-[10px] md:text-[11px] text-muted tabular-nums whitespace-nowrap font-display tracking-wider">
                  {sets.length} {sets.length === 1 ? "pack" : "packs"} ·{" "}
                  {cardTotal.toLocaleString()} cards
                </div>
              </header>

              {/* Horizontal snap rail */}
              <div
                className="flex gap-3 md:gap-4 overflow-x-auto pb-3 pt-1 -mx-4 md:-mx-6 px-4 md:px-6 scrollbar-none"
                style={{
                  scrollSnapType: "x mandatory",
                  scrollPaddingLeft: "16px",
                }}
              >
                {sets.map((s) => (
                  <div
                    key={s.id}
                    style={{ scrollSnapAlign: "start" }}
                    className="shrink-0"
                  >
                    <PackTile
                      set={s}
                      cardCount={getCardCount(s.id)}
                      size="sm"
                    />
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Quiet footer CTA */}
      <section className="border-t-[3px] border-ink bg-ink text-paper-strong">
        <div className="max-w-[1300px] mx-auto px-4 md:px-6 py-8 md:py-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="font-display text-[18px] md:text-[22px] tracking-tight max-w-[42ch]">
            Can&apos;t see your pack? Search the full catalogue by name.
          </p>
          <Link
            href="/search"
            className="pop-block inline-flex items-center justify-center bg-yellow text-ink px-4 py-2 font-display text-[12px] tracking-wider uppercase rounded-md"
          >
            Search all {totalCards.toLocaleString()} cards →
          </Link>
        </div>
      </section>
    </main>
  );
}
