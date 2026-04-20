/**
 * pokemontcg.io v2 card shape.
 *
 * The JSON files in `data/tcg/en/` are arrays of objects matching this
 * interface. Most properties are optional because Trainer / Energy cards
 * and some Wizards promos omit Pokémon-only fields (hp, types, attacks…).
 *
 * Phase 2 will swap this fixture for Supabase-backed data. The Phase 1
 * interface therefore mirrors the upstream shape verbatim; any projection
 * into our own schema happens in the fixture loader, not here.
 */

export type Supertype = "Pokémon" | "Trainer" | "Energy";

export interface CardImages {
  small: string;
  large: string;
}

export interface CardAttack {
  name: string;
  cost?: string[];
  convertedEnergyCost?: number;
  damage?: string;
  text?: string;
}

export interface CardAbility {
  name: string;
  text: string;
  type: string;
}

export interface CardWeaknessResistance {
  type: string;
  value: string;
}

export interface CardLegalities {
  unlimited?: "Legal" | "Banned";
  standard?: "Legal" | "Banned";
  expanded?: "Legal" | "Banned";
}

export interface Card {
  id: string;
  name: string;
  supertype: Supertype;
  subtypes?: string[];
  level?: string;
  hp?: string;
  types?: string[];
  evolvesFrom?: string;
  evolvesTo?: string[];
  rules?: string[];
  abilities?: CardAbility[];
  attacks?: CardAttack[];
  weaknesses?: CardWeaknessResistance[];
  resistances?: CardWeaknessResistance[];
  retreatCost?: string[];
  convertedRetreatCost?: number;
  number: string;
  artist?: string;
  rarity?: string;
  flavorText?: string;
  nationalPokedexNumbers?: number[];
  legalities?: CardLegalities;
  regulationMark?: string;
  images: CardImages;
}

export interface CardSet {
  id: string;
  name: string;
  series: string;
  releaseYear: number;
  releaseDate: string;
  printedTotal: number;
  total: number;
  logoUrl?: string;
  symbolUrl?: string;
}
