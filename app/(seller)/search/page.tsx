import Link from "next/link";
import { Button, Input, Select, Field } from "@/components/ui/Form";
import { CardImage } from "@/components/cardbuy/CardImage";
import { CardValueOverlay } from "@/components/cardbuy/CardValueOverlay";
import { EnergyChip } from "@/components/cardbuy/EnergyChip";
import {
  getAllCards,
  CARD_SETS,
  setIdOf,
  getSetsGroupedBySeries,
} from "@/lib/fixtures/cards";
import { getMockCardById } from "@/lib/fixtures/mock-adapter";
import { computeMockOffer } from "@/lib/mock/mock-offer";
import { getMarginConfig } from "@/app/_actions/margins";
import { getLatestPricesForCards } from "@/app/_actions/prices";
import { pickHeadlinePrice } from "@/lib/prices/types";
import type { Card } from "@/lib/types/card";
import type { Condition, MockCard } from "@/lib/mock/types";

type SearchParams = Promise<{
  q?: string;
  set?: string;
  rarity?: string;
  supertype?: string;
  page?: string;
}>;

const PAGE_SIZE = 24;

function filter(cards: Card[], sp: Awaited<SearchParams>): Card[] {
  let out = cards;
  if (sp.q) {
    const q = sp.q.toLowerCase();
    out = out.filter((c) => c.name.toLowerCase().includes(q));
  }
  if (sp.set) out = out.filter((c) => setIdOf(c) === sp.set);
  if (sp.rarity) out = out.filter((c) => (c.rarity ?? "Promo") === sp.rarity);
  if (sp.supertype) out = out.filter((c) => c.supertype === sp.supertype);
  return out;
}

const ALL = getAllCards();
const RARITIES = Array.from(
  new Set(ALL.map((c) => c.rarity ?? "Promo")),
).sort();
const SUPERTYPES = Array.from(new Set(ALL.map((c) => c.supertype))).sort();
const SERIES_GROUPS = getSetsGroupedBySeries();

function queryString(sp: Record<string, string | undefined>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (v) usp.set(k, v);
  const s = usp.toString();
  return s ? `?${s}` : "";
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const results = filter(ALL, sp);
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = results.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const activeSet = sp.set ? CARD_SETS.find((s) => s.id === sp.set) : undefined;
  const hasActiveFilter = Boolean(sp.set || sp.rarity || sp.supertype || sp.q);

  // Compute headline NM-raw offers for the cards on this page so each
  // tile can show "£X.XX" or a "NOT BUYING" stamp at a glance. Live
  // TCGCSV prices override the synthetic mock baseline where available
  // — same overlay pattern as the card detail page so grid ↔ detail
  // stay consistent.
  const [marginConfig, livePriceMap] = await Promise.all([
    getMarginConfig(),
    getLatestPricesForCards(paged.map((c) => c.id)),
  ]);
  const offerByCardId = new Map<
    string,
    { offerGbp: number; belowMin: boolean }
  >();
  for (const c of paged) {
    const mockCard = getMockCardById(c.id);
    if (!mockCard) continue;
    const headline = pickHeadlinePrice(livePriceMap.get(c.id) ?? []);
    const liveCard: MockCard = headline?.price_market
      ? (() => {
          const live = Number(headline.price_market);
          const sale = marginConfig.confidence_threshold + 1;
          const conds: Condition[] = ["NM", "LP", "MP", "HP", "DMG"];
          const overridden = { ...mockCard.raw_prices };
          for (const cond of conds) {
            overridden[cond] = {
              market: live,
              low: Number(headline.price_low ?? live),
              high: Number(headline.price_high ?? live),
              sale_count: sale,
            };
          }
          return { ...mockCard, raw_prices: overridden };
        })()
      : mockCard;
    const offer = computeMockOffer(
      liveCard,
      { variant: "raw", condition: "NM" },
      marginConfig,
    );
    offerByCardId.set(c.id, {
      offerGbp: offer.offerGbp,
      belowMin: offer.belowMin,
    });
  }

  return (
    <div className="max-w-[1300px] mx-auto px-5 md:px-4 py-6 md:py-8 flex flex-col gap-5">
      {/* Breadcrumb back to packs when a set is active — shows the set
          logo as a tiny badge so sellers feel the continuity from the
          pack they just tore open. */}
      {activeSet ? (
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href="/packs"
            className="font-display text-[10px] md:text-[11px] tracking-[0.2em] uppercase text-muted hover:text-pink underline underline-offset-4 decoration-2"
          >
            ← All packs
          </Link>
          <span className="text-muted">/</span>
          <div className="flex items-center gap-2 bg-paper-strong border-[3px] border-ink rounded-md px-2 py-1 shadow-[3px_3px_0_0_var(--color-ink)]">
            {activeSet.symbolUrl ? (
              <span className="relative w-5 h-5 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activeSet.symbolUrl}
                  alt=""
                  className="w-full h-full object-contain"
                />
              </span>
            ) : null}
            <span className="font-display text-[12px] md:text-[13px] tracking-tight uppercase">
              {activeSet.name}
            </span>
            <span className="font-display text-[10px] text-muted tabular-nums">
              {activeSet.releaseYear}
            </span>
          </div>
          <Link
            href={`/search${queryString({ q: sp.q, rarity: sp.rarity, supertype: sp.supertype })}`}
            className="text-[10px] md:text-[11px] font-display tracking-wider uppercase text-muted hover:text-pink underline underline-offset-4 decoration-2"
          >
            clear pack
          </Link>
        </div>
      ) : null}

      <header className="flex flex-col gap-3">
        <span className="bg-yellow text-ink border-2 border-ink w-fit px-2 py-1 font-display text-[10px] tracking-wider rounded-sm">
          Sell to us
        </span>
        <h1 className="font-display text-[32px] md:text-[52px] leading-none tracking-tight">
          {activeSet
            ? `${activeSet.name} — every card.`
            : "What are you selling?"}
        </h1>
        <p className="text-[13px] text-secondary max-w-prose">
          {activeSet
            ? `Tap any card to see our offer. ${results.length.toLocaleString()} cards in this pack.`
            : `Search the full catalogue — ${ALL.length.toLocaleString()} cards across ${CARD_SETS.length} sets from Base Set to the current era.`}
        </p>
        <form
          action="/search"
          method="GET"
          className="flex flex-col sm:flex-row gap-2 mt-1"
        >
          <Input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Charizard, Mewtwo, Pikachu…"
            className="flex-1"
          />
          {sp.set ? <input type="hidden" name="set" value={sp.set} /> : null}
          {sp.rarity ? (
            <input type="hidden" name="rarity" value={sp.rarity} />
          ) : null}
          <Button type="submit" size="lg">Search</Button>
        </form>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
        <aside className="pop-card rounded-md h-fit overflow-hidden">
          <details className="md:contents" open>
            <summary className="md:hidden cursor-pointer list-none px-4 py-3 flex items-center justify-between border-b-2 border-ink font-display text-[14px] tracking-wider hover:bg-yellow/30">
              <span>Filters</span>
              <span className="text-[11px] text-muted">tap to toggle</span>
            </summary>
            <div className="p-4 flex flex-col gap-4">
              <h2 className="hidden md:block font-display text-[14px] tracking-wider">
                Filters
              </h2>
              <form action="/search" method="GET" className="flex flex-col gap-3">
                {sp.q ? <input type="hidden" name="q" value={sp.q} /> : null}
                <Field label="Pack (set)">
                  <Select name="set" defaultValue={sp.set ?? ""}>
                    <option value="">All packs</option>
                    {SERIES_GROUPS.map((g) => (
                      <optgroup key={g.series} label={g.series}>
                        {g.sets.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.releaseYear})
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </Select>
                </Field>
                <Field label="Rarity">
                  <Select name="rarity" defaultValue={sp.rarity ?? ""}>
                    <option value="">Any rarity</option>
                    {RARITIES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Supertype">
                  <Select name="supertype" defaultValue={sp.supertype ?? ""}>
                    <option value="">All types</option>
                    {SUPERTYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Button
                  type="submit"
                  variant="secondary"
                  size="sm"
                  className="w-full"
                >
                  Apply filters
                </Button>
                {hasActiveFilter ? (
                  <Link
                    href="/search"
                    className="text-[11px] font-display tracking-wider text-muted hover:text-pink text-center underline underline-offset-2"
                  >
                    clear all filters
                  </Link>
                ) : null}
              </form>

              {!activeSet ? (
                <div className="pt-3 border-t-2 border-ink/10">
                  <Link
                    href="/packs"
                    className="font-display text-[11px] tracking-wider uppercase text-ink bg-yellow border-2 border-ink rounded-md px-3 py-1.5 inline-flex items-center gap-1 hover:bg-pink"
                  >
                    Browse by pack →
                  </Link>
                </div>
              ) : null}
            </div>
          </details>
        </aside>

        <section className="flex flex-col gap-5">
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <h2 className="font-display text-[16px] tracking-wider">
              {results.length.toLocaleString()} of {ALL.length.toLocaleString()} cards
              {activeSet ? (
                <span className="text-muted"> · {activeSet.name}</span>
              ) : null}
            </h2>
            {pageCount > 1 ? (
              <span className="text-[11px] text-muted font-display tracking-wider">
                Page {currentPage} / {pageCount}
              </span>
            ) : null}
          </div>

          {results.length === 0 ? (
            <div className="pop-card rounded-md p-12 text-center flex flex-col gap-2 items-center">
              <span className="font-display text-[24px]">No matches</span>
              <span className="text-[13px] text-secondary">
                Try a broader search.
              </span>
            </div>
          ) : (
            <ul
              className="cards-entrance grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5"
              key={`${sp.set ?? "all"}-${currentPage}`}
            >
              {paged.map((card) => {
                const tileOffer = offerByCardId.get(card.id);
                return (
                <li key={card.id}>
                  <Link
                    href={`/card/${card.id}`}
                    className="group block pop-card rounded-md p-3 flex flex-col gap-2 transition-transform hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_var(--color-ink)]"
                  >
                    <div className="relative">
                      <CardImage
                        src={card.images.small}
                        alt={card.name}
                        size="md"
                        rarity={card.rarity}
                      />
                      {tileOffer ? (
                        <CardValueOverlay
                          offerGbp={tileOffer.offerGbp}
                          belowMin={tileOffer.belowMin}
                        />
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-1 pt-1">
                      <div className="font-display text-[13px] leading-tight line-clamp-2 min-h-[28px]">
                        {card.name}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-muted font-display tracking-wider">
                        <span>#{card.number}</span>
                        {card.hp ? <span>· HP {card.hp}</span> : null}
                        {card.types?.[0] ? (
                          <span className="ml-auto">
                            <EnergyChip type={card.types[0]} />
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[10px] text-secondary uppercase tracking-wider truncate">
                        {card.rarity ?? "Promo"}
                      </div>
                    </div>
                    <span className="text-[11px] font-display tracking-wider mt-1 group-hover:text-pink underline underline-offset-4">
                      View offer →
                    </span>
                  </Link>
                </li>
                );
              })}
            </ul>
          )}

          {/* Pagination */}
          {pageCount > 1 ? (
            <div className="border-t-2 border-ink/20 pt-4 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex gap-2">
                <Link
                  href={`/search${queryString({ ...sp, page: String(Math.max(1, currentPage - 1)) })}`}
                  aria-disabled={currentPage <= 1}
                  className={`border-2 border-ink rounded-sm px-3 py-1.5 font-display text-[11px] tracking-wider ${
                    currentPage <= 1
                      ? "text-muted border-rule pointer-events-none"
                      : "hover:bg-yellow"
                  }`}
                >
                  ← PREV
                </Link>
                <Link
                  href={`/search${queryString({ ...sp, page: String(Math.min(pageCount, currentPage + 1)) })}`}
                  aria-disabled={currentPage >= pageCount}
                  className={`border-2 border-ink rounded-sm px-3 py-1.5 font-display text-[11px] tracking-wider ${
                    currentPage >= pageCount
                      ? "text-muted border-rule pointer-events-none"
                      : "hover:bg-yellow"
                  }`}
                >
                  NEXT →
                </Link>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
