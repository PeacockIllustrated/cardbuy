import "server-only";
import { getCardById } from "@/lib/fixtures/cards";
import type { LewisListing } from "@/lib/supabase/types";
import type { MockListing } from "@/lib/mock/types";

/**
 * Enrich a raw DB listing row with the card-fixture fields so the
 * existing `ListingCard` / shop UI (which expects the Phase-1
 * `MockListing` shape) can consume it without changes.
 *
 * The fixture is server-only, which is why this module is too.
 */
export function adaptListing(l: LewisListing): MockListing {
  const card = getCardById(l.card_id);
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
    price_gbp: Number(l.price_gbp),
    cost_basis_gbp: Number(l.cost_basis_gbp),
    qty_in_stock: l.qty_in_stock,
    qty_reserved: l.qty_reserved,
    status: l.status,
    is_featured: l.is_featured,
    featured_priority: l.featured_priority,
    condition_notes: l.condition_notes,
    created_at: l.created_at,
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
