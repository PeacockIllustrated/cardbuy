import Link from "next/link";
import { Button, Input } from "@/components/ui/Form";
import { ListingCard } from "@/components/cardbuy/ListingCard";
import { PackTile } from "@/components/cardbuy/PackTile";
import { getFeaturedListings } from "@/lib/mock/mock-listings";
import Image from "next/image";
import { HeroCardReel } from "@/components/cardbuy/HeroCardReel";
import { WaveDivider } from "@/components/cardbuy/WaveDivider";
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
          That area&apos;s admin-only. Ask Aqua TCG to promote your account if
          you think that&apos;s wrong.
        </div>
      ) : null}

      {/* BRAND IDENTITY HERO — Aqua TCG mark + wordmark + tagline on
          the brand-ocean ground, with a pop-art sunburst behind the
          logo and a wave seam into the content below. */}
      <section className="bg-ocean relative overflow-hidden">
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
          {/* LOGO MARK — the Aqua TCG lockup as the hero focal point.
              A slow gold sunburst + soft light halo lift the blue-field
              logo off the ocean ground with no container box. */}
          <div className="relative shrink-0 w-[230px] h-[230px] sm:w-[260px] sm:h-[260px] md:w-[320px] md:h-[320px] flex items-center justify-center">
            {/* Radiating gold sunburst — pure decoration */}
            <div
              aria-hidden="true"
              className="absolute inset-[-26%] animate-[spin_30s_linear_infinite] motion-reduce:animate-none"
              style={{
                background:
                  "repeating-conic-gradient(from 0deg, var(--color-sun) 0deg 8deg, transparent 8deg 18deg)",
                WebkitMaskImage:
                  "radial-gradient(circle, #000 33%, transparent 68%)",
                maskImage:
                  "radial-gradient(circle, #000 33%, transparent 68%)",
              }}
            />
            {/* Soft white halo so the blue mark separates from blue bg */}
            <div
              aria-hidden="true"
              className="absolute inset-[15%] rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.42) 46%, transparent 72%)",
              }}
            />
            <Image
              src="/aqua-tcg.svg"
              alt="Aqua TCG"
              width={300}
              height={325}
              priority
              className="relative w-[64%] md:w-[68%] h-auto [filter:drop-shadow(5px_5px_0_var(--color-ink))]"
            />
            {/* Comic-book star accent */}
            <div className="absolute top-0 right-1 md:top-2 md:right-3 w-10 h-10 md:w-14 md:h-14 bg-paper-strong border-[3px] border-ink rounded-full flex items-center justify-center rotate-12">
              <span className="font-display text-[12px] md:text-[16px] leading-none text-ink">
                ★
              </span>
            </div>
          </div>

          {/* WORDMARK + TAGLINE */}
          <div className="flex flex-col gap-3 md:gap-4 text-center md:text-left">
            <span className="font-display text-[10px] md:text-[11px] tracking-widest text-ink bg-sun border-2 border-ink px-2 py-1 rounded-sm w-fit mx-auto md:mx-0">
              POKÉMON TCG · UK
            </span>

            <h1 className="font-display leading-[0.85] tracking-tight text-[52px] sm:text-[76px] md:text-[96px] lg:text-[120px] text-paper-strong [text-shadow:4px_4px_0_var(--color-ink)]">
              AQUA
              <br />
              <span className="text-sun">TCG</span>
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
              <span className="font-display text-[10px] tracking-widest bg-sun text-ink px-2 py-1 rounded-sm border-2 border-ink">
                SINGLE-MERCHANT
              </span>
            </div>
          </div>
        </div>
        <WaveDivider
          fill="var(--color-paper)"
          height={44}
          className="relative z-[1] -mb-px"
        />
      </section>

      {/* DUAL HERO */}
      <section className="bg-paper">
        <div className="max-w-[1300px] mx-auto px-5 md:px-4 py-6 md:py-14 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {/* SELL TO US */}
          <div className="pop-block bg-sun rounded-lg p-5 md:p-8 flex flex-col gap-4 md:gap-5">
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
              className="text-[12px] font-display tracking-wider underline underline-offset-4 hover:text-ocean"
            >
              Browse the buylist
            </Link>
          </div>

          {/* BUY FROM US */}
          <div className="pop-block bg-wave rounded-lg p-5 md:p-8 flex flex-col gap-4 md:gap-5">
            <span className="bg-ink text-paper-strong px-2 py-1 w-fit font-display text-[10px] tracking-wider">
              Buy from us
            </span>
            <h2 className="font-display text-[24px] sm:text-[32px] md:text-[40px] lg:text-[44px] leading-[0.95] tracking-tight">
              Hand-picked singles, slabs, and sealed.
            </h2>
            <p className="text-[13px] md:text-[14px] text-secondary max-w-[42ch]">
              Aqua TCG curates every listing. Free Royal Mail Tracked over £250. UK
              dispatch within one working day.
            </p>
            <Link href="/shop" className="block">
              <Button size="lg" variant="secondary" className="w-full">
                Browse the shop →
              </Button>
            </Link>
            <Link
              href="/shop?sort=newest"
              className="text-[12px] font-display tracking-wider underline underline-offset-4 hover:text-ocean"
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
              <span className="bg-ocean text-ink border-2 border-ink w-fit px-2 py-1 font-display text-[10px] tracking-wider rounded-sm">
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
                  className="font-display text-[12px] tracking-wider underline underline-offset-4 decoration-2 self-center hover:text-ocean"
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
        <section className="bg-ocean border-y-[3px] border-ink">
          <div className="max-w-[1300px] mx-auto px-5 md:px-4 py-10 flex flex-col gap-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
              <h3 className="font-display text-[22px] sm:text-[28px] md:text-[36px] leading-none tracking-tight text-paper-strong">
                Aqua TCG picks this week
              </h3>
              <Link
                href="/shop"
                className="font-display text-[12px] tracking-wider text-paper-strong border-b-2 border-paper-strong pb-1 w-fit hover:text-sun hover:border-sun"
              >
                View all in shop →
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
              {featured.map((l, i) => {
                const card = getCardById(l.card_id);
                const elementalType = resolveElementalType(card?.types?.[0]);
                return (
                  <ListingCard
                    key={l.id}
                    listing={l}
                    compact
                    accent={(["sun", "wave", "sun", "wave"] as const)[i % 4]}
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
            <span className="bg-sun text-ink border-2 border-ink w-fit px-2 py-1 font-display text-[10px] tracking-wider">
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
                  <span className="font-display text-[24px] leading-none text-ocean shrink-0">
                    {n}
                  </span>
                  <span className="text-[14px] pt-1">{t}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="flex flex-col gap-3">
            <span className="bg-wave text-ink border-2 border-ink w-fit px-2 py-1 font-display text-[10px] tracking-wider">
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
                  <span className="font-display text-[24px] leading-none text-wave shrink-0">
                    {n}
                  </span>
                  <span className="text-[14px] pt-1">{t}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

    </div>
  );
}
