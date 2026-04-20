/**
 * Bridge between the real `Card` fixture (pokemontcg.io shape) and the
 * Phase 1 `MockCard` shape that the offer engine, OfferBuilder, mock
 * listings, and mock submissions all still consume.
 *
 * Raw and graded prices aren't available from the pokemontcg.io catalogue
 * — those ship from PokemonPriceTracker in Phase 2. Until then we
 * synthesise plausible numbers from rarity + a stable hash of the card id
 * so every card renders a deterministic offer, every render.
 *
 * Phase 2 will delete this file and wire the OfferBuilder directly to
 * real `cb_prices` rows.
 */

import type { Card } from "@/lib/types/card";
import type {
  Condition,
  GradedPriceEntry,
  GradedPrices,
  GradingCompany,
  MockCard,
  RawPrices,
} from "@/lib/mock/types";
import { getAllCards, setIdOf, setOf, LAST_SYNCED } from "./cards";

function hash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}

/**
 * Rarity → rough mid-condition NM USD baseline. These mirror what
 * first-gen Base/Jungle/Fossil raw cards roughly trade at in 2024-era
 * markets (rough order-of-magnitude, not a live feed).
 */
function rarityBaseline(rarity: string | undefined): number {
  switch (rarity) {
    case "Rare Holo":    return 140;
    case "Rare":         return 22;
    case "Uncommon":     return 4;
    case "Common":       return 1.2;
    case "Promo":        return 55;
    default:             return 6;
  }
}

const CONDITION_RATIO: Record<Condition, number> = {
  NM: 1.0, LP: 0.82, MP: 0.6, HP: 0.38, DMG: 0.18,
};

function jitter(h: number, spread = 0.25): number {
  const unit = ((h >>> 0) % 1000) / 1000; // 0..1
  return 1 - spread / 2 + unit * spread;  // 1 ± spread/2
}

function synthRawPrices(id: string, rarity: string | undefined): RawPrices {
  const h = hash(id);
  const base = rarityBaseline(rarity) * jitter(h, 0.4);
  const saleBase = Math.max(2, Math.floor(jitter(h >>> 3, 0.9) * 40));
  const out: RawPrices = {};
  (Object.keys(CONDITION_RATIO) as Condition[]).forEach((c, i) => {
    const mid = +(base * CONDITION_RATIO[c]).toFixed(2);
    out[c] = {
      market: mid,
      low: +(mid * 0.82).toFixed(2),
      high: +(mid * 1.18).toFixed(2),
      sale_count: Math.max(0, saleBase - i * 4),
    };
  });
  return out;
}

function synthGradedPrices(id: string, rarity: string | undefined): GradedPrices {
  // Only holo / promo cards get meaningful graded market data in P1 mock.
  if (rarity !== "Rare Holo" && rarity !== "Promo") return {};
  const h = hash(id);
  const nmMarket = rarityBaseline(rarity) * jitter(h, 0.4);

  const entry = (mult: number, spread: number, salesSeed: number): GradedPriceEntry => {
    const market = +(nmMarket * mult).toFixed(2);
    return {
      market,
      low: +(market * (1 - spread)).toFixed(2),
      high: +(market * (1 + spread)).toFixed(2),
      sale_count: Math.max(1, salesSeed % 24),
    };
  };

  const psa: Partial<Record<string, GradedPriceEntry>> = {
    "10": entry(9,   0.12, h >>> 2),
    "9":  entry(3.2, 0.14, h >>> 4),
    "8":  entry(1.4, 0.18, h >>> 6),
  };
  const cgc: Partial<Record<string, GradedPriceEntry>> = {
    "10":  entry(7.5, 0.13, h >>> 8),
    "9.5": entry(4.1, 0.16, h >>> 10),
  };

  return { PSA: psa, CGC: cgc } as unknown as Record<GradingCompany, Partial<Record<string, GradedPriceEntry>>>;
}

/**
 * Project a real `Card` into the MockCard shape that legacy mocks expect.
 * Synthesised raw + graded prices are deterministic per card id.
 */
export function toMockCard(card: Card): MockCard {
  const set = setOf(card);
  const setId = setIdOf(card);
  return {
    id: card.id,
    name: card.name,
    set_id: setId,
    set_name: set?.name ?? setId,
    card_number: card.number,
    rarity: card.rarity ?? "Promo",
    language: "EN",
    release_year: set?.releaseYear ?? 1999,
    image_url: card.images.small,
    image_url_large: card.images.large,
    raw_prices: synthRawPrices(card.id, card.rarity),
    graded_prices: synthGradedPrices(card.id, card.rarity),
    sale_count_30d: Math.max(2, Math.floor(jitter(hash(card.id), 0.9) * 40)),
    last_synced: `${LAST_SYNCED}T00:00:00.000Z`,
  };
}

export const MOCK_CARDS: MockCard[] = getAllCards().map(toMockCard);

const MOCK_CARDS_BY_ID: Map<string, MockCard> = new Map(
  MOCK_CARDS.map((c) => [c.id, c]),
);

export function getMockCardById(id: string): MockCard | undefined {
  return MOCK_CARDS_BY_ID.get(id);
}
