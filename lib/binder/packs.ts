/**
 * Server-only helpers for the Binder "Packs" view. Resolving a card
 * id to its set requires the fixture loader, which is server-only.
 */

import "server-only";
import { getAllSets, getCardById, setIdOf } from "@/lib/fixtures/cards";
import type { ItemVariant } from "@/lib/supabase/types";

export type BinderPackSummary = {
  setId: string;
  setName: string;
  series: string;
  releaseYear: number;
  releaseDate: string;
  logoUrl: string | null;
  symbolUrl: string | null;
  printedTotal: number;
  /** Distinct cards from this pack the user owns at least one of. */
  cardsOwnedDistinct: number;
  /** Sum of quantity across all entries in this pack. */
  copiesTotal: number;
  /** True for packs the user has zero cards from. Used by the binder
   *  to render them as locked silhouettes after the started ones. */
  locked: boolean;
};

export type PackCardEntry = {
  id: string;
  name: string;
  number: string;
  imageSmall: string | null;
  rarity: string | null;
  supertype: string;
  owned: boolean;
  quantity: number;
  variants: ItemVariant[];
};

export type PackDetailPayload = {
  setId: string;
  setName: string;
  series: string;
  releaseYear: number;
  printedTotal: number;
  cards: PackCardEntry[];
};

/**
 * Build pack summaries for **every** set in the catalogue, marking
 * each as either started (the user owns at least one card from it)
 * or locked (none owned). Sort order:
 *
 *   1. Started packs first, newest release date first.
 *   2. Locked packs after, also newest release date first.
 *
 * That order matches the user's request — collectors should land on
 * the packs they're already working on without paging through dozens
 * of locked silhouettes.
 *
 * Entries whose card_id can't be resolved (a set not yet bundled in
 * the Phase-1 fixture) are skipped — the locked summary for that set
 * still appears via the catalogue walk.
 */
export function summarisePacks(
  entries: { card_id: string; quantity: number }[],
): BinderPackSummary[] {
  const distinctByPack = new Map<string, Set<string>>();
  const copiesByPack = new Map<string, number>();
  for (const e of entries) {
    const card = getCardById(e.card_id);
    if (!card) continue;
    const sid = setIdOf(card);
    let distinct = distinctByPack.get(sid);
    if (!distinct) {
      distinct = new Set();
      distinctByPack.set(sid, distinct);
    }
    distinct.add(e.card_id);
    copiesByPack.set(sid, (copiesByPack.get(sid) ?? 0) + e.quantity);
  }

  const out: BinderPackSummary[] = getAllSets().map((set) => {
    const distinct = distinctByPack.get(set.id);
    const ownedDistinct = distinct?.size ?? 0;
    return {
      setId: set.id,
      setName: set.name,
      series: set.series,
      releaseYear: set.releaseYear,
      releaseDate: set.releaseDate,
      logoUrl: set.logoUrl ?? null,
      symbolUrl: set.symbolUrl ?? null,
      printedTotal: set.printedTotal,
      cardsOwnedDistinct: ownedDistinct,
      copiesTotal: copiesByPack.get(set.id) ?? 0,
      locked: ownedDistinct === 0,
    };
  });

  out.sort((a, b) => {
    if (a.locked !== b.locked) return a.locked ? 1 : -1;
    return b.releaseDate.localeCompare(a.releaseDate);
  });
  return out;
}
