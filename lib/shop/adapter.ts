import "server-only";
import { getCardById } from "@/lib/fixtures/cards";
import { resolveElementalType } from "@/components/cardbuy/particles/recipes";
import type { LewisListing } from "@/lib/supabase/types";
import type { MockListing } from "@/lib/mock/types";

/** FNV-1a → [0, 1). Used to derive a deterministic per-listing "market
 *  price" markup so the strike-through number is stable across reads
 *  but varied across listings. */
function seedFraction(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1_000_000) / 1_000_000;
}

const NEW_IN_WINDOW_DAYS = 14;
const NEW_IN_WINDOW_MS = NEW_IN_WINDOW_DAYS * 86_400_000;

/**
 * Enrich a raw DB listing row with the card-fixture fields so the
 * existing `ListingCard` / shop UI (which expects the Phase-1
 * `MockListing` shape) can consume it without changes.
 *
 * The fixture is server-only, which is why this module is too.
 */
export function adaptListing(l: LewisListing): MockListing {
  const card = getCardById(l.card_id);
  const priceGbp = Number(l.price_gbp);
  // 12–34% markup over the list price → plausible "market reference"
  // figure for the strike-through. Phase 7+ replaces this with a real
  // number sourced from the pricing pipeline.
  const markup = 0.12 + seedFraction(l.id) * 0.22;
  const marketRaw = priceGbp * (1 + markup);
  const marketRounded = Math.round(marketRaw * 100) / 100;
  const marketMeaningful = marketRounded - priceGbp >= 1;
  const ageMs = Date.now() - new Date(l.created_at).getTime();

  return {
    id: l.id,
    card_id: l.card_id,
    card_name: card?.name ?? l.card_id,
    set_name: SET_NAMES[l.card_id.split("-")[0]] ?? l.card_id.split("-")[0],
    rarity: card?.rarity ?? "Common",
    image_url: card?.images.small ?? null,
    sku: l.sku,
    variant: l.variant,
    condition: l.condition ?? undefined,
    grading_company: l.grading_company ?? undefined,
    grade: l.grade ?? undefined,
    price_gbp: priceGbp,
    cost_basis_gbp: Number(l.cost_basis_gbp),
    qty_in_stock: l.qty_in_stock,
    qty_reserved: l.qty_reserved,
    status: l.status,
    is_featured: l.is_featured,
    featured_priority: l.featured_priority,
    condition_notes: l.condition_notes,
    created_at: l.created_at,
    market_price_gbp: marketMeaningful ? marketRounded : undefined,
    is_new_in: ageMs >= 0 && ageMs < NEW_IN_WINDOW_MS,
    elemental_type: resolveElementalType(card?.types?.[0]),
  };
}

const SET_NAMES: Record<string, string> = {
  base1: "Base Set",
  base2: "Jungle",
  base3: "Fossil",
  base4: "Base Set 2",
  base5: "Team Rocket",
  basep: "Wizards Black Star Promos",
};
