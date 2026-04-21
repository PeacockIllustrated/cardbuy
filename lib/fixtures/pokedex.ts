import "server-only";
import type { Card } from "@/lib/types/card";
import { getAllCards } from "./cards";

export type DexEntry = {
  number: number;
  name: string;
  types: string[];
  sampleCardId: string | null;
};

/** Gen-1 national dex slice (1–151). Built once at module init from the
 *  pokemontcg.io fixture. For each dex number we pick the shortest-named
 *  card as the canonical representative — this filters out prefixed prints
 *  like "Dark Charizard" or "Shining Magikarp" in favour of the base name. */
export const GEN1_DEX: DexEntry[] = (() => {
  const byDex = new Map<number, Card[]>();
  for (const c of getAllCards()) {
    const n = c.nationalPokedexNumbers?.[0];
    if (!n || n < 1 || n > 151) continue;
    const list = byDex.get(n) ?? [];
    list.push(c);
    byDex.set(n, list);
  }

  const out: DexEntry[] = [];
  for (let n = 1; n <= 151; n++) {
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
