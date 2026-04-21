import "server-only";
import type { Card } from "@/lib/types/card";
import { getAllCards } from "./cards";

export type DexEntry = {
  number: number;
  name: string;
  types: string[];
  sampleCardId: string | null;
};

/**
 * Full national-dex registry (1 → max observed dex number across the
 * card fixture). Built once at module init. For each dex number we
 * pick the shortest-named Pokémon card as the canonical representative
 * — this filters out prefixed prints like "Dark Charizard" / "Shining
 * Magikarp" / mega / ex / V / VMAX variants in favour of the base name.
 *
 * Gaps (numbers with no fixture coverage) are filled with `name: "???"`
 * so the binder UI can still render a slot + accept ownership entries
 * that arrive later.
 */
export const NATIONAL_DEX: DexEntry[] = (() => {
  const byDex = new Map<number, Card[]>();
  let maxDex = 151;
  for (const c of getAllCards()) {
    // Trainer + Energy cards don't belong in the Pokédex — they live
    // in the side shelf instead.
    if (c.supertype !== "Pokémon") continue;
    const n = c.nationalPokedexNumbers?.[0];
    if (!n || n < 1) continue;
    if (n > maxDex) maxDex = n;
    const list = byDex.get(n) ?? [];
    list.push(c);
    byDex.set(n, list);
  }

  const out: DexEntry[] = [];
  for (let n = 1; n <= maxDex; n++) {
    const cards = byDex.get(n);
    if (!cards || cards.length === 0) {
      out.push({ number: n, name: "???", types: [], sampleCardId: null });
      continue;
    }
    const canonical = [...cards].sort(
      (a, b) => a.name.length - b.name.length,
    )[0];
    out.push({
      number: n,
      name: canonical.name,
      types: canonical.types ?? [],
      sampleCardId: canonical.id,
    });
  }
  return out;
})();

/** Kept as an alias so older imports (GEN1_DEX) still resolve to the
 *  full national dex. Code migrating to the new name can import
 *  NATIONAL_DEX directly. */
export const GEN1_DEX = NATIONAL_DEX;
