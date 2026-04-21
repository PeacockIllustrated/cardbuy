import { notFound } from "next/navigation";
import Link from "next/link";
import { getCardById, setOf } from "@/lib/fixtures/cards";
import { getMockCardById } from "@/lib/fixtures/mock-adapter";
import { OfferBuilder } from "@/components/cardbuy/OfferBuilder";
import { BinderChipRow } from "@/components/cardbuy/binder/BinderChipRow";
import { CardImage } from "@/components/cardbuy/CardImage";
import { EnergyChip, EnergyCostRow } from "@/components/cardbuy/EnergyChip";
import { Annotation } from "@/components/wireframe/Annotation";
import { createClient } from "@/lib/supabase/server";
import { getCardBinderStatus } from "@/app/_actions/binder";
import { getMarginConfig } from "@/app/_actions/margins";
import { getLatestPricesForCard } from "@/app/_actions/prices";
import { pickHeadlinePrice } from "@/lib/prices/types";
import { PriceSourceChip } from "@/components/cardbuy/PriceSourceChip";
import type { Condition, MockCard } from "@/lib/mock/types";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{
  prefill_variant?: string;
  prefill_condition?: string;
  prefill_company?: string;
  prefill_grade?: string;
}>;

export default async function CardDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const card = getCardById(id);
  const mockCard = getMockCardById(id);
  if (!card || !mockCard) notFound();

  const set = setOf(card);

  const supabase = await createClient();
  const [{ data: { user } }, marginConfig, livePrices, binderStatus, mapRow] = await Promise.all([
    supabase.auth.getUser(),
    getMarginConfig(),
    getLatestPricesForCard(id),
    getCardBinderStatus(id),
    supabase
      .from("lewis_card_tcg_map")
      .select("card_id")
      .eq("card_id", id)
      .maybeSingle(),
  ]);

  // Admin gate for the "not mapped" hint — avoid leaking internal
  // state to regular sellers. Uses the same role check pattern as
  // admin-only action gates elsewhere.
  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from("lewis_users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    isAdmin = (profile as { role?: string } | null)?.role === "admin";
  }

  // If the nightly sync has covered this card, override the mock USD
  // baseline with the live TCGplayer market price. Condition
  // multipliers in the margin config still discount it from there.
  const headline = pickHeadlinePrice(livePrices);
  const liveCard: MockCard = headline?.price_market
    ? (() => {
        const live = Number(headline.price_market);
        const sale = marginConfig.confidence_threshold + 1; // not low-conf
        const conds: Condition[] = ["NM", "LP", "MP", "HP", "DMG"];
        const overridden = { ...mockCard.raw_prices };
        for (const c of conds) {
          overridden[c] = {
            market: live,
            low: Number(headline.price_low ?? live),
            high: Number(headline.price_high ?? live),
            sale_count: sale,
          };
        }
        return { ...mockCard, raw_prices: overridden };
      })()
    : mockCard;
  const priceSource: "live" | "mock" = headline?.price_market ? "live" : "mock";

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-4 py-8 flex flex-col gap-8">
      <nav className="text-[12px] font-display tracking-wider flex items-center gap-3 flex-wrap">
        <Link href="/packs" className="text-muted hover:text-pink">
          ← ALL PACKS
        </Link>
        <span className="text-rule">/</span>
        {set ? (
          <Link
            href={`/search?set=${set.id}`}
            className="inline-flex items-center gap-2 bg-paper-strong border-[3px] border-ink rounded-md px-2 py-1 shadow-[3px_3px_0_0_var(--color-ink)] hover:bg-yellow transition-colors"
          >
            {set.symbolUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={set.symbolUrl}
                alt=""
                className="w-4 h-4 object-contain"
              />
            ) : null}
            <span className="text-ink tracking-tight">
              {set.name.toUpperCase()}
            </span>
          </Link>
        ) : (
          <span className="text-muted">Unknown set</span>
        )}
        <span className="text-rule">·</span>
        <span className="text-muted tabular-nums">
          #{card.number} / {set?.printedTotal ?? "?"}
        </span>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-[360px_1fr] gap-10 lg:gap-14">
        {/* LEFT — card art + quick facts */}
        <div className="flex flex-col gap-5 items-center">
          <div className="relative">
            <CardImage
              src={card.images.large}
              alt={card.name}
              size="lg"
              priority
              rarity={card.rarity}
              enableDeviceTilt
            />
          </div>

          {/* Confidence + sync strip */}
          <div className="pop-card rounded-md p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between text-[10px] font-display tracking-wider">
              <span className="text-muted">ILLUSTRATED BY</span>
              <span>{card.artist ?? "—"}</span>
            </div>
            {card.flavorText ? (
              <p className="text-[12px] leading-snug text-secondary italic border-t-2 border-ink/15 pt-2">
                “{card.flavorText}”
              </p>
            ) : null}
          </div>
        </div>

        {/* RIGHT — headline + offer + lore */}
        <div className="flex flex-col gap-8">
          <header className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-[10px] tracking-wider text-yellow bg-ink px-2 py-1 rounded-sm">
                We want to buy this
              </span>
              {card.rarity ? (
                <span className="font-display text-[10px] tracking-wider bg-pink text-ink border-2 border-ink px-2 py-1 rounded-sm">
                  {card.rarity}
                </span>
              ) : null}
              {card.supertype ? (
                <span className="font-display text-[10px] tracking-wider bg-paper-strong text-ink border-2 border-ink px-2 py-1 rounded-sm">
                  {card.supertype}
                </span>
              ) : null}
              {card.subtypes?.map((st) => (
                <span
                  key={st}
                  className="font-display text-[10px] tracking-wider bg-paper-strong text-secondary border-2 border-rule px-2 py-1 rounded-sm"
                >
                  {st}
                </span>
              ))}
            </div>

            <h1 className="font-display text-[40px] md:text-[56px] leading-[0.9] tracking-tight">
              {card.name}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-[13px] text-secondary">
              <span>{set?.name}</span>
              <span className="text-rule">·</span>
              <span>#{card.number}</span>
              <span className="text-rule">·</span>
              <span>{set?.releaseYear ?? "—"}</span>
              {card.hp ? (
                <>
                  <span className="text-rule">·</span>
                  <span className="font-display tracking-wider text-ink">
                    HP {card.hp}
                  </span>
                </>
              ) : null}
              {card.types && card.types.length > 0 ? (
                <>
                  <span className="text-rule">·</span>
                  <span className="inline-flex gap-1">
                    {card.types.map((t) => (
                      <EnergyChip key={t} type={t} size="md" />
                    ))}
                  </span>
                </>
              ) : null}
            </div>

            {card.evolvesFrom ? (
              <div className="text-[12px] text-secondary">
                Evolves from <span className="font-display tracking-wider">{card.evolvesFrom.toUpperCase()}</span>
              </div>
            ) : null}
          </header>

          <BinderChipRow
            cardId={id}
            cardName={card.name}
            isAuthenticated={Boolean(user)}
            initialEntries={binderStatus.entries}
            initialOnWishlist={binderStatus.onWishlist}
          />

          <PriceSourceChip
            status={priceSource}
            variant={headline?.variant ?? null}
            marketUsd={
              headline?.price_market !== undefined &&
              headline.price_market !== null
                ? Number(headline.price_market)
                : null
            }
            sourceUpdatedAt={
              headline?.source_updated_at ?? headline?.fetched_at ?? null
            }
            adminUnmappedHint={
              isAdmin && priceSource === "mock" && !mapRow.data
            }
          />

          <OfferBuilder
            card={liveCard}
            config={marginConfig}
            isAuthenticated={Boolean(user)}
            prefill={{
              variant:
                sp.prefill_variant === "graded" ? "graded" : undefined,
              condition: sp.prefill_condition as Condition | undefined,
              company: sp.prefill_company as
                | "PSA"
                | "CGC"
                | "BGS"
                | "SGC"
                | "ACE"
                | undefined,
              grade: sp.prefill_grade as
                | "10"
                | "9.5"
                | "9"
                | "8.5"
                | "8"
                | "7"
                | undefined,
            }}
          />

          {/* Abilities */}
          {card.abilities && card.abilities.length > 0 ? (
            <section className="flex flex-col gap-3">
              <Annotation>POKÉMON POWER · ABILITIES</Annotation>
              <ul className="flex flex-col gap-3">
                {card.abilities.map((a, i) => (
                  <li key={`${a.name}-${i}`} className="pop-card rounded-md p-4 flex flex-col gap-2">
                    <div className="flex items-baseline gap-2">
                      <span className="font-display text-[10px] tracking-wider bg-yellow text-ink border-2 border-ink px-2 py-0.5 rounded-sm">
                        {a.type}
                      </span>
                      <span className="font-display text-[18px] tracking-tight">{a.name}</span>
                    </div>
                    <p className="text-[13px] leading-snug text-secondary">{a.text}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Attacks */}
          {card.attacks && card.attacks.length > 0 ? (
            <section className="flex flex-col gap-3">
              <Annotation>ATTACKS</Annotation>
              <ul className="flex flex-col gap-3">
                {card.attacks.map((atk, i) => (
                  <li
                    key={`${atk.name}-${i}`}
                    className="pop-card rounded-md p-4 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3">
                        <EnergyCostRow cost={atk.cost} />
                        <span className="font-display text-[18px] tracking-tight">
                          {atk.name}
                        </span>
                      </div>
                      <span className="font-display text-[28px] tabular-nums tracking-tight">
                        {atk.damage && atk.damage !== "" ? atk.damage : "—"}
                      </span>
                    </div>
                    {atk.text ? (
                      <p className="text-[13px] leading-snug text-secondary border-t-2 border-ink/10 pt-2">
                        {atk.text}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Combat stats row */}
          {(card.weaknesses?.length || card.resistances?.length || card.retreatCost?.length) ? (
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="pop-card rounded-md p-3 flex flex-col gap-2">
                <span className="font-display text-[10px] tracking-wider text-muted">WEAKNESS</span>
                {card.weaknesses && card.weaknesses.length > 0 ? (
                  <div className="flex items-center gap-2">
                    {card.weaknesses.map((w, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5">
                        <EnergyChip type={w.type} />
                        <span className="font-display text-[14px] tabular-nums">{w.value}</span>
                      </span>
                    ))}
                  </div>
                ) : <span className="text-[12px] text-muted">None</span>}
              </div>
              <div className="pop-card rounded-md p-3 flex flex-col gap-2">
                <span className="font-display text-[10px] tracking-wider text-muted">RESISTANCE</span>
                {card.resistances && card.resistances.length > 0 ? (
                  <div className="flex items-center gap-2">
                    {card.resistances.map((r, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5">
                        <EnergyChip type={r.type} />
                        <span className="font-display text-[14px] tabular-nums">{r.value}</span>
                      </span>
                    ))}
                  </div>
                ) : <span className="text-[12px] text-muted">None</span>}
              </div>
              <div className="pop-card rounded-md p-3 flex flex-col gap-2">
                <span className="font-display text-[10px] tracking-wider text-muted">RETREAT</span>
                {card.retreatCost && card.retreatCost.length > 0 ? (
                  <EnergyCostRow cost={card.retreatCost} />
                ) : <span className="text-[12px] text-muted">Free</span>}
              </div>
            </section>
          ) : null}

          {/* Legalities footer */}
          {card.legalities && Object.keys(card.legalities).length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-display tracking-wider">
              <span className="text-muted">FORMATS</span>
              {Object.entries(card.legalities).map(([fmt, status]) => (
                <span
                  key={fmt}
                  className={`border-2 border-ink px-2 py-0.5 rounded-sm ${
                    status === "Legal" ? "bg-teal text-ink" : "bg-paper-strong text-muted"
                  }`}
                >
                  {fmt} · {status}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
