import Link from "next/link";
import { Button, Input } from "@/components/ui/Form";
import { ListingCard } from "@/components/cardbuy/ListingCard";
import { PackTile } from "@/components/cardbuy/PackTile";
import { getFeaturedListings } from "@/lib/mock/mock-listings";
import { HeroCardReel } from "@/components/cardbuy/HeroCardReel";
import {
  getCardById,
  getSetById,
  getCardCount,
} from "@/lib/fixtures/cards";
import { resolveElementalType } from "@/components/cardbuy/particles/recipes";
import type { Card } from "@/lib/types/card";

/**
 * Rarity-ladder hero picks. Ordered Common → Promo so the scroll reel
 * walks the visitor up the chase hierarchy.
 *   base1-58  Pikachu     · Common
 *   base1-29  Haunter     · Uncommon
 *   base1-17  Beedrill    · Rare
 *   base1-4   Charizard   · Rare Holo
 *   basep-8   Mew         · Promo
 */
const HERO_CARD_IDS = ["base1-58", "base1-29", "base1-17", "base1-4", "basep-8"] as const;

/** Featured pack for the homepage spotlight. Swap the id to rotate. */
const SPOTLIGHT_PACK_IDS = ["base1", "swsh12pt5", "sv1", "neo1"] as const;

type SearchParams = Promise<{ error?: string }>;

export default async function HomePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const featured = getFeaturedListings(4);
  const heroCards = HERO_CARD_IDS
    .map((id) => getCardById(id))
    .filter((c): c is Card => Boolean(c));
  const heroReady = heroCards.length === 5;

  // Pick the first spotlight pack that resolves — resilient to data swaps.
  const spotlightSet =
    SPOTLIGHT_PACK_IDS.map((id) => getSetById(id)).find((s) => s) ?? undefined;
  const spotlightCount = spotlightSet ? getCardCount(spotlightSet.id) : 0;

  return (
    <div className="flex flex-col">
      {sp.error === "admin_required" ? (
        <div className="border-b-[3px] border-ink bg-warn text-paper-strong px-4 py-2 font-display text-[12px] tracking-wider text-center">
          That area&apos;s admin-only. Ask Lewis to promote your account if
          you think that&apos;s wrong.
        </div>
      ) : null}

      {/* BRAND IDENTITY HERO — placeholder mark + wordmark + tagline.
          Everything here is a stand-in for the real brand (Phase 5
          sign-off). The structure is deliberate so the final logo and
          name drop straight into the same slots. */}
      <section className="bg-yellow border-b-[3px] border-ink relative overflow-hidden">
        {/* Decorative pop-art dot grid — purely ornamental, screens out
            for assistive tech. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "radial-gradient(var(--color-ink) 1.5px, transparent 1.5px)",
            backgroundSize: "18px 18px",
          }}
        />

        <div className="relative max-w-[1300px] mx-auto px-5 md:px-8 py-10 md:py-16 lg:py-20 flex flex-col md:flex-row items-center gap-8 md:gap-12">
          {/* LOGO MARK — stacked pop-art shapes standing in for the
              real mark. Three-colour overlap reads as "brand" at a
              glance without committing to anything. */}
          <div
            aria-label="Brand logo placeholder"
            className="relative shrink-0 w-[140px] h-[140px] md:w-[180px] md:h-[180px]"
          >
            {/* Back teal square */}
            <div className="absolute inset-0 bg-teal border-[3px] border-ink rounded-lg rotate-[-6deg] translate-x-2 translate-y-2" />
            {/* Pink circle */}
            <div className="absolute inset-2 bg-pink border-[3px] border-ink rounded-full" />
            {/* Foreground ink square with monogram */}
            <div className="absolute inset-5 bg-ink rounded-md border-[3px] border-ink flex items-center justify-center">
              <span className="font-display text-[56px] md:text-[72px] leading-none text-yellow">
                L
              </span>
            </div>
            {/* Starburst accent */}
            <div className="absolute -top-3 -right-3 w-10 h-10 md:w-12 md:h-12 bg-paper-strong border-[3px] border-ink rounded-full flex items-center justify-center rotate-12">
              <span className="font-display text-[11px] md:text-[13px] leading-none text-ink">
                ★
              </span>
            </div>
          </div>

          {/* WORDMARK + TAGLINE */}
          <div className="flex flex-col gap-3 md:gap-4 text-center md:text-left">
            <span className="font-display text-[10px] md:text-[11px] tracking-widest text-ink bg-paper-strong border-2 border-ink px-2 py-1 rounded-sm w-fit mx-auto md:mx-0">
              [BRAND NAME · PLACEHOLDER]
            </span>

            <h1 className="font-display leading-[0.88] tracking-tight text-[44px] sm:text-[64px] md:text-[84px] lg:text-[104px]">
              LEWIS&apos;S
              <br />
              <span className="relative inline-block">
                POKÉMON
                <span
                  aria-hidden="true"
                  className="absolute left-0 right-0 -bottom-1 h-[6px] md:h-[8px] bg-ink"
                />
              </span>
            </h1>

            <p className="font-display text-[12px] sm:text-[14px] md:text-[16px] tracking-wider text-ink max-w-[48ch] mx-auto md:mx-0">
              [TAGLINE · TBC] &nbsp;·&nbsp; Buy, sell, repeat.
            </p>

            <div className="flex flex-wrap gap-2 justify-center md:justify-start pt-1">
              <span className="font-display text-[10px] tracking-widest bg-ink text-paper-strong px-2 py-1 rounded-sm border-2 border-ink">
                EST. TBC
              </span>
              <span className="font-display text-[10px] tracking-widest bg-paper-strong text-ink px-2 py-1 rounded-sm border-2 border-ink">
                UK · GBP
              </span>
              <span className="font-display text-[10px] tracking-widest bg-pink text-ink px-2 py-1 rounded-sm border-2 border-ink">
                SINGLE-MERCHANT
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* DUAL HERO */}
      <section className="bg-paper">
        <div className="max-w-[1300px] mx-auto px-5 md:px-4 py-6 md:py-14 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {/* SELL TO US */}
          <div className="pop-block bg-yellow rounded-lg p-5 md:p-8 flex flex-col gap-4 md:gap-5">
            <span className="bg-ink text-paper-strong px-2 py-1 w-fit font-display text-[10px] tracking-wider">
              Sell to us
            </span>
            <h2 className="font-display text-[24px] sm:text-[32px] md:text-[40px] lg:text-[44px] leading-[0.95] tracking-tight">
              Get an instant offer for your Pokémon cards.
            </h2>
            <p className="text-[13px] md:text-[14px] text-secondary max-w-[42ch]">
              Search the buylist, pick the condition, see your offer in GBP. Post your cards in
              and get paid by PayPal — usually within 3 days.
            </p>
            <form action="/search" method="GET" className="flex flex-col sm:flex-row gap-2">
              <Input
                name="q"
                placeholder="card name, set, number"
                aria-label="search cards to sell"
                className="flex-1"
              />
              <Button type="submit" size="lg" className="w-full sm:w-auto">
                Get offer →
              </Button>
            </form>
            <Link
              href="/search"
              className="text-[12px] font-display tracking-wider underline underline-offset-4 hover:text-pink"
            >
              Browse the buylist
            </Link>
          </div>

          {/* BUY FROM US */}
          <div className="pop-block bg-teal rounded-lg p-5 md:p-8 flex flex-col gap-4 md:gap-5">
            <span className="bg-ink text-paper-strong px-2 py-1 w-fit font-display text-[10px] tracking-wider">
              Buy from us
            </span>
            <h2 className="font-display text-[24px] sm:text-[32px] md:text-[40px] lg:text-[44px] leading-[0.95] tracking-tight">
              Hand-picked singles, slabs, and sealed.
            </h2>
            <p className="text-[13px] md:text-[14px] text-secondary max-w-[42ch]">
              Lewis curates every listing himself. Free Royal Mail Tracked over £250. UK
              dispatch within one working day.
            </p>
            <Link href="/shop" className="block">
              <Button size="lg" variant="secondary" className="w-full">
                Browse the shop →
              </Button>
            </Link>
            <Link
              href="/shop?sort=newest"
              className="text-[12px] font-display tracking-wider underline underline-offset-4 hover:text-pink"
            >
              See newest listings
            </Link>
          </div>
        </div>
      </section>

      {heroReady ? (
        <HeroCardReel cards={heroCards as [Card, Card, Card, Card, Card]} />
      ) : null}

      {/* PACK SPOTLIGHT — showcases the new sell-side flow with a real
          foil pack visual. Single featured pack on the left, CTA stack
          on the right. Click tears it open into /search?set=<id>. */}
      {spotlightSet ? (
        <section className="border-t-[3px] border-ink bg-paper">
          <div className="max-w-[1300px] mx-auto px-5 md:px-6 py-10 md:py-14 grid grid-cols-1 md:grid-cols-[260px_1fr] gap-8 md:gap-12 items-center">
            <div className="mx-auto md:mx-0 w-[200px] md:w-[240px]">
              <PackTile set={spotlightSet} cardCount={spotlightCount} />
            </div>
            <div className="flex flex-col gap-4 md:gap-5">
              <span className="bg-pink text-ink border-2 border-ink w-fit px-2 py-1 font-display text-[10px] tracking-wider rounded-sm">
                New · Sell by pack
              </span>
              <h2 className="font-display text-[28px] md:text-[44px] leading-[0.95] tracking-tight">
                Sell by pack — tap, tear, see your offer.
              </h2>
              <p className="text-[13px] md:text-[14px] text-secondary max-w-[54ch]">
                Pick the pack your cards came from, tap to tear it open,
                and we&apos;ll show you every card inside with an instant
                GBP offer. Every set from Base to Surging Sparks.
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <Link href="/packs" className="inline-block">
                  <Button size="lg">Browse packs →</Button>
                </Link>
                <Link
                  href="/search"
                  className="font-display text-[12px] tracking-wider underline underline-offset-4 decoration-2 self-center hover:text-pink"
                >
                  or search by name
                </Link>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* FEATURED RAIL */}
      {featured.length > 0 ? (
        <section className="bg-pink border-y-[3px] border-ink">
          <div className="max-w-[1300px] mx-auto px-5 md:px-4 py-10 flex flex-col gap-6">
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <h3 className="font-display text-[28px] md:text-[36px] leading-none tracking-tight text-paper-strong">
                Lewis&apos;s picks this week
              </h3>
              <Link
                href="/shop"
                className="font-display text-[12px] tracking-wider text-paper-strong border-b-2 border-paper-strong pb-1 hover:text-yellow hover:border-yellow"
              >
                View all in shop →
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {featured.map((l, i) => {
                const card = getCardById(l.card_id);
                const elementalType = resolveElementalType(card?.types?.[0]);
                return (
                  <ListingCard
                    key={l.id}
                    listing={l}
                    compact
                    accent={(["yellow", "teal", "yellow", "teal"] as const)[i % 4]}
                    elementalType={elementalType}
                  />
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {/* HOW IT WORKS */}
      <section className="bg-paper">
        <div className="max-w-[1300px] mx-auto px-5 md:px-4 py-12 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="flex flex-col gap-3">
            <span className="bg-yellow text-ink border-2 border-ink w-fit px-2 py-1 font-display text-[10px] tracking-wider">
              Selling
            </span>
            <h3 className="font-display text-[24px] tracking-tight leading-tight">
              How selling to us works
            </h3>
            <ol className="flex flex-col gap-3 mt-2">
              {[
                ["1", "Search your cards on the buylist."],
                ["2", "Pick the condition — get an instant GBP offer."],
                ["3", "Post your cards. Get paid by PayPal."],
              ].map(([n, t]) => (
                <li key={n} className="pop-card rounded-md p-4 flex gap-3 items-start">
                  <span className="font-display text-[24px] leading-none text-pink shrink-0">
                    {n}
                  </span>
                  <span className="text-[14px] pt-1">{t}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="flex flex-col gap-3">
            <span className="bg-teal text-ink border-2 border-ink w-fit px-2 py-1 font-display text-[10px] tracking-wider">
              Buying
            </span>
            <h3 className="font-display text-[24px] tracking-tight leading-tight">
              How buying from us works
            </h3>
            <ol className="flex flex-col gap-3 mt-2">
              {[
                ["1", "Browse the shop — filter by set, rarity, or grade."],
                ["2", "Add to basket. Pay by card at checkout."],
                ["3", "Royal Mail delivers — tracked as standard."],
              ].map(([n, t]) => (
                <li key={n} className="pop-card rounded-md p-4 flex gap-3 items-start">
                  <span className="font-display text-[24px] leading-none text-teal shrink-0">
                    {n}
                  </span>
                  <span className="text-[14px] pt-1">{t}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="bg-ink text-paper-strong">
        <div className="max-w-[1300px] mx-auto px-5 md:px-4 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "paid out to sellers", value: "£128,402", tone: "yellow" },
              { label: "cards bought", value: "14,213", tone: "yellow" },
              { label: "cards sold via shop", value: "9,476", tone: "teal" },
              { label: "average payout", value: "3.2 days", tone: "pink" },
            ].map((s) => (
              <div key={s.label} className="flex flex-col gap-1">
                <span
                  className={`font-display text-[36px] md:text-[44px] leading-none tracking-tight tabular-nums ${
                    s.tone === "yellow"
                      ? "text-yellow"
                      : s.tone === "teal"
                        ? "text-teal"
                        : "text-pink"
                  }`}
                >
                  {s.value}
                </span>
                <span className="font-display text-[10px] tracking-wider text-paper-strong/70">
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
