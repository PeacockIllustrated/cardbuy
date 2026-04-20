import { MOCK_CARDS } from "@/lib/fixtures/mock-adapter";
import type { MockListing } from "./types";

/**
 * Listings = individual physical inventory units Lewis has for sale.
 * Each row references a card from the real first-gen catalogue
 * (base1-* through basep-*) and represents one specific copy at one
 * condition + price.
 *
 * 12 listings across the catalogue, mix of raw + graded, varied stock,
 * 3 flagged featured.
 */

function listing(
  i: number,
  card_id: string,
  init: Omit<
    MockListing,
    | "id"
    | "card_id"
    | "card_name"
    | "set_name"
    | "rarity"
    | "image_url"
    | "sku"
    | "qty_reserved"
    | "created_at"
  > & { qty_reserved?: number }
): MockListing {
  const card = MOCK_CARDS.find((c) => c.id === card_id);
  if (!card) throw new Error(`mock-listings: unknown card_id ${card_id}`);
  const skuVariant =
    init.variant === "raw" ? init.condition : `${init.grading_company}${init.grade}`;
  return {
    id: `lst-${String(i).padStart(3, "0")}`,
    card_id,
    card_name: card.name,
    set_name: card.set_name,
    rarity: card.rarity,
    image_url: card.image_url,
    sku: `${card_id.toUpperCase()}-${skuVariant}-${String(i).padStart(2, "0")}`,
    qty_reserved: init.qty_reserved ?? 0,
    created_at: "2026-04-15T10:00:00.000Z",
    ...init,
  };
}

// Real card picks:
// base1-4  Charizard (Rare Holo · Base Set)
// base1-2  Blastoise (Rare Holo · Base Set)
// base1-15 Venusaur  (Rare Holo · Base Set)
// base1-13 Mewtwo    (Rare Holo · Base Set)
// base1-58 Pikachu   (Common   · Base Set)
// base2-6  Pinsir    (Rare Holo · Jungle)
// base3-1  Aerodactyl(Rare Holo · Fossil)
// base3-13 Zapdos    (Rare Holo · Fossil)
// base4-3  Ninetales (Rare Holo · Base Set 2)
// base5-4  Dark Charizard (Rare Holo · Team Rocket)
// basep-1  Pikachu (Ivy) (Promo)

export const MOCK_LISTINGS: MockListing[] = [
  // Featured headline pieces
  listing(1, "base1-4", {
    variant: "graded",
    grading_company: "PSA",
    grade: "9",
    price_gbp: 949,
    cost_basis_gbp: 700,
    qty_in_stock: 1,
    status: "active",
    is_featured: true,
    featured_priority: 1,
    condition_notes: "Centring 55/45, sharp corners.",
  }),
  listing(2, "base1-2", {
    variant: "graded",
    grading_company: "PSA",
    grade: "10",
    price_gbp: 3990,
    cost_basis_gbp: 3100,
    qty_in_stock: 1,
    status: "active",
    is_featured: true,
    featured_priority: 2,
    condition_notes: "Pristine. Sealed in PSA case.",
  }),
  listing(3, "base3-13", {
    variant: "graded",
    grading_company: "PSA",
    grade: "10",
    price_gbp: 1295,
    cost_basis_gbp: 950,
    qty_in_stock: 1,
    status: "active",
    is_featured: true,
    featured_priority: 3,
    condition_notes: null,
  }),

  // Raw mid-tier inventory
  listing(4, "base1-4", {
    variant: "raw",
    condition: "NM",
    price_gbp: 425,
    cost_basis_gbp: 320,
    qty_in_stock: 1,
    status: "active",
    is_featured: false,
    featured_priority: null,
    condition_notes: "Clean. No whitening.",
  }),
  listing(5, "base1-4", {
    variant: "raw",
    condition: "LP",
    price_gbp: 320,
    cost_basis_gbp: 240,
    qty_in_stock: 2,
    status: "active",
    is_featured: false,
    featured_priority: null,
    condition_notes: "Light edge wear.",
  }),
  listing(6, "base1-13", {
    variant: "raw",
    condition: "NM",
    price_gbp: 95,
    cost_basis_gbp: 65,
    qty_in_stock: 3,
    status: "active",
    is_featured: false,
    featured_priority: null,
    condition_notes: null,
  }),
  listing(7, "base2-6", {
    variant: "raw",
    condition: "NM",
    price_gbp: 38,
    cost_basis_gbp: 22,
    qty_in_stock: 8,
    qty_reserved: 1,
    status: "active",
    is_featured: false,
    featured_priority: null,
    condition_notes: null,
  }),
  listing(8, "base3-1", {
    variant: "graded",
    grading_company: "PSA",
    grade: "10",
    price_gbp: 165,
    cost_basis_gbp: 105,
    qty_in_stock: 2,
    status: "active",
    is_featured: false,
    featured_priority: null,
    condition_notes: null,
  }),
  listing(9, "base4-3", {
    variant: "raw",
    condition: "NM",
    price_gbp: 175,
    cost_basis_gbp: 110,
    qty_in_stock: 1,
    status: "active",
    is_featured: false,
    featured_priority: null,
    condition_notes: "Fresh from box.",
  }),

  // Bulk
  listing(10, "base1-58", {
    variant: "raw",
    condition: "NM",
    price_gbp: 6.5,
    cost_basis_gbp: 2.4,
    qty_in_stock: 47,
    status: "active",
    is_featured: false,
    featured_priority: null,
    condition_notes: "Bulk Base Set Pikachu.",
  }),

  // Hidden / sold-out edge cases
  listing(11, "base1-15", {
    variant: "raw",
    condition: "MP",
    price_gbp: 60,
    cost_basis_gbp: 40,
    qty_in_stock: 0,
    status: "sold_out",
    is_featured: false,
    featured_priority: null,
    condition_notes: null,
  }),
  listing(12, "base5-4", {
    variant: "raw",
    condition: "NM",
    price_gbp: 480,
    cost_basis_gbp: 320,
    qty_in_stock: 1,
    status: "hidden",
    is_featured: false,
    featured_priority: null,
    condition_notes: "Hidden pending photo refresh.",
  }),
];

export function getFeaturedListings(limit = 4): MockListing[] {
  return MOCK_LISTINGS.filter(
    (l) => l.is_featured && l.status === "active" && l.qty_in_stock > 0
  )
    .sort((a, b) => (a.featured_priority ?? 99) - (b.featured_priority ?? 99))
    .slice(0, limit);
}

export const FEATURED_SLOT_COUNT = 4;
