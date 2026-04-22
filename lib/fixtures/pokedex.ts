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

/* ─────────────────────────────────────────────────────────────────
 * Region glossary — national-dex ranges grouped by Pokémon region.
 * Used by the binder's region tab filter. Ranges are inclusive.
 *
 * Hisui (899–905) is bundled into Galar for the UI since it's a
 * generation-8 expansion and its 7 entries don't warrant their own
 * tab. A future revision can split them if someone collects them
 * seriously.
 * ───────────────────────────────────────────────────────────────── */

export type RegionId =
  | "kanto"
  | "johto"
  | "hoenn"
  | "sinnoh"
  | "unova"
  | "kalos"
  | "alola"
  | "galar"
  | "paldea";

export type Region = {
  id: RegionId;
  label: string;
  gen: number;
  start: number;
  end: number;
};

export const REGIONS: Region[] = [
  { id: "kanto",  label: "Kanto",  gen: 1, start: 1,    end: 151 },
  { id: "johto",  label: "Johto",  gen: 2, start: 152,  end: 251 },
  { id: "hoenn",  label: "Hoenn",  gen: 3, start: 252,  end: 386 },
  { id: "sinnoh", label: "Sinnoh", gen: 4, start: 387,  end: 493 },
  { id: "unova",  label: "Unova",  gen: 5, start: 494,  end: 649 },
  { id: "kalos",  label: "Kalos",  gen: 6, start: 650,  end: 721 },
  { id: "alola",  label: "Alola",  gen: 7, start: 722,  end: 809 },
  { id: "galar",  label: "Galar",  gen: 8, start: 810,  end: 905 },
  { id: "paldea", label: "Paldea", gen: 9, start: 906,  end: 1025 },
];

export function regionForDex(n: number): Region | null {
  for (const r of REGIONS) {
    if (n >= r.start && n <= r.end) return r;
  }
  return null;
}
