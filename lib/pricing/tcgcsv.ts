/**
 * Read-only TCGCSV client. Phase 3 slice 1 — no DB writes, no persistence.
 *
 * TCGCSV (https://tcgcsv.com) is a free, hobby-maintained daily mirror
 * of TCGplayer's full catalogue + market-price data. Pokémon is
 * category 3. No auth, no API key. FAQ asks for a courtesy 250ms pause
 * between requests, which we respect via `sleepPolite`.
 *
 * Scope of this module: fetch groups (sets), products, and prices for
 * a given group, with typed responses. Downstream slices (mapping,
 * sync job, persistence) consume these primitives.
 *
 * No fallbacks, no caching here — callers decide policy. Each call
 * is a fresh HTTP request because we want predictable freshness when
 * the sync job runs.
 */

import "server-only";

const TCGCSV_BASE = "https://tcgcsv.com/tcgplayer/3";
const POLITENESS_MS = 250;

/** A single TCGplayer set / product line. */
export type TcgGroup = {
  groupId: number;
  name: string;
  abbreviation: string | null;
  isSupplemental: boolean;
  publishedOn: string; // ISO
  modifiedOn: string; // ISO
  categoryId: number;
};

/** Extended-data entry attached to each product (rarity, HP, number, etc). */
export type TcgExtendedField = {
  name: string;
  displayName: string;
  value: string;
};

/** A single product in a group — maps to a Pokémon card variant. */
export type TcgProduct = {
  productId: number;
  name: string;
  cleanName: string;
  imageUrl: string;
  categoryId: number;
  groupId: number;
  url: string;
  modifiedOn: string;
  imageCount: number;
  extendedData: TcgExtendedField[];
};

/** A single price row — one per (productId, subTypeName) pair. */
export type TcgPrice = {
  productId: number;
  lowPrice: number | null;
  midPrice: number | null;
  highPrice: number | null;
  marketPrice: number | null;
  directLowPrice: number | null;
  /** "Normal" · "Holofoil" · "Reverse Holofoil" · "Unlimited Holofoil" · etc. */
  subTypeName: string;
};

type TcgResponse<T> = {
  success: boolean;
  errors: string[];
  results: T[];
};

/**
 * Fetch with a short User-Agent + forced freshness. Throws on HTTP
 * error or `success: false` — callers can catch and decide fallback
 * behaviour (typically: keep stale prices, log the failure).
 */
async function rawFetch<T>(url: string): Promise<TcgResponse<T>> {
  const res = await fetch(url, {
    headers: { "User-Agent": "lewis-pokemon-platform/0.1 (phase3-verification)" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`TCGCSV ${res.status} ${res.statusText} · ${url}`);
  }
  const json = (await res.json()) as TcgResponse<T>;
  if (!json.success) {
    throw new Error(`TCGCSV body error · ${json.errors?.join(", ") || "no detail"}`);
  }
  return json;
}

/** Fetch every Pokémon (category 3) group — ~215 entries. */
export async function fetchGroups(): Promise<TcgGroup[]> {
  const { results } = await rawFetch<TcgGroup>(`${TCGCSV_BASE}/groups`);
  return results;
}

/** Fetch every product (card variant) in a single group. */
export async function fetchProducts(groupId: number): Promise<TcgProduct[]> {
  const { results } = await rawFetch<TcgProduct>(
    `${TCGCSV_BASE}/${groupId}/products`,
  );
  return results;
}

/** Fetch every price row in a single group. One row per (productId, subTypeName). */
export async function fetchPrices(groupId: number): Promise<TcgPrice[]> {
  const { results } = await rawFetch<TcgPrice>(
    `${TCGCSV_BASE}/${groupId}/prices`,
  );
  return results;
}

/** Courtesy pause between successive TCGCSV requests. Batch-loop with this. */
export async function sleepPolite(): Promise<void> {
  await new Promise((r) => setTimeout(r, POLITENESS_MS));
}

/**
 * Resolve our internal set ids (e.g. `base1`) to TCGCSV groupIds by
 * exact-match on group name. Each local set carries a list of
 * candidate names; the first alias that resolves wins. Unmatched
 * sets return `null` so the preview page can surface them.
 *
 * The alias list lets us handle naming drift between our local
 * catalogue (pokemontcg.io) and TCGCSV without a code change each
 * time TCGplayer renames a group.
 */
export async function resolveGroupIds(
  sets: Record<string, readonly string[]>,
): Promise<Record<string, number | null>> {
  const groups = await fetchGroups();
  const byName = new Map(
    groups.map((g) => [g.name.trim().toLowerCase(), g.groupId]),
  );
  const out: Record<string, number | null> = {};
  for (const [localId, aliases] of Object.entries(sets)) {
    let found: number | null = null;
    for (const alias of aliases) {
      const hit = byName.get(alias.trim().toLowerCase());
      if (hit != null) {
        found = hit;
        break;
      }
    }
    out[localId] = found;
  }
  return out;
}

/**
 * Pokemontcg.io set id → TCGCSV group-name alias map. Covers 170 of
 * the 172 sets in `pokemon-tcg-data/`. First alias per set is the
 * canonical TCGCSV group name; additional entries are legacy /
 * alternate spellings. Generated + spot-checked via
 * `scripts/resolve-tcgcsv-aliases.mjs`; hand-edited overrides live
 * alongside the auto-resolved entries.
 *
 * Intentionally unmapped (TCGCSV has no equivalent group):
 *   - `mcd21` (McDonald's Collection 2021) — TCGCSV skips 2021
 *   - `fut20` (Pokémon Futsal Collection) — regional 2020 promo
 * These cards continue to fall back to mock pricing.
 *
 * Known split-group gap — Base Set Machamp (#8/102) is absent from
 * "Base Set" (group 604) because TCGplayer catalogued it only under
 * "Base Set (Shadowless)" (group 1663). A per-card override table
 * is a separate follow-up.
 *
 * Note: `tk1a`/`tk1b` and `tk2a`/`tk2b` are split on pokemontcg.io
 * (Latias vs Latios, Plusle vs Minun) but TCGCSV bundles each pair
 * into one group, so both halves alias to the same target.
 */
export const PHASE3_SLICE1_SETS: Record<string, readonly string[]> = {
  base1: ["Base Set"],
  base2: ["Jungle"],
  base3: ["Fossil"],
  base4: ["Base Set 2"],
  base5: ["Team Rocket"],
  basep: ["WoTC Promo", "Wizards Black Star Promos"],
  base6: ["Legendary Collection"],
  bp: ["Best of Promos"],
  bw1: ["Black and White"],
  bw10: ["Plasma Blast"],
  bw11: ["Legendary Treasures"],
  bw2: ["Emerging Powers"],
  bw3: ["Noble Victories"],
  bw4: ["Next Destinies"],
  bw5: ["Dark Explorers"],
  bw6: ["Dragons Exalted"],
  bw7: ["Boundaries Crossed"],
  bw8: ["Plasma Storm"],
  bw9: ["Plasma Freeze"],
  bwp: ["Black and White Promos"],
  cel25: ["Celebrations"],
  cel25c: ["Celebrations: Classic Collection"],
  col1: ["Call of Legends"],
  dc1: ["Double Crisis"],
  det1: ["Detective Pikachu"],
  dp1: ["Diamond and Pearl"],
  dp2: ["Mysterious Treasures"],
  dp3: ["Secret Wonders"],
  dp4: ["Great Encounters"],
  dp5: ["Majestic Dawn"],
  dp6: ["Legends Awakened"],
  dp7: ["Stormfront"],
  dpp: ["Diamond and Pearl Promos"],
  dv1: ["Dragon Vault"],
  ecard1: ["Expedition"],
  ecard2: ["Aquapolis"],
  ecard3: ["Skyridge"],
  ex1: ["Ruby and Sapphire"],
  ex10: ["Unseen Forces"],
  ex11: ["Delta Species"],
  ex12: ["Legend Maker"],
  ex13: ["Holon Phantoms"],
  ex14: ["Crystal Guardians"],
  ex15: ["Dragon Frontiers"],
  ex16: ["Power Keepers"],
  ex2: ["Sandstorm"],
  ex3: ["Dragon"],
  ex4: ["Team Magma vs Team Aqua"],
  ex5: ["Hidden Legends"],
  ex6: ["FireRed & LeafGreen"],
  ex7: ["Team Rocket Returns"],
  ex8: ["Deoxys"],
  ex9: ["Emerald"],
  g1: ["Generations"],
  gym1: ["Gym Heroes"],
  gym2: ["Gym Challenge"],
  hgss1: ["HeartGold SoulSilver"],
  hgss2: ["Unleashed"],
  hgss3: ["Undaunted"],
  hgss4: ["Triumphant"],
  hsp: ["HGSS Promos"],
  mcd11: ["McDonald's Promos 2011"],
  mcd12: ["McDonald's Promos 2012"],
  mcd14: ["McDonald's Promos 2014"],
  mcd15: ["McDonald's Promos 2015"],
  mcd16: ["McDonald's Promos 2016"],
  mcd17: ["McDonald's Promos 2017"],
  mcd18: ["McDonald's Promos 2018"],
  mcd19: ["McDonald's Promos 2019"],
  mcd22: ["McDonald's Promos 2022"],
  me1: ["ME01: Mega Evolution"],
  me2: ["ME02: Phantasmal Flames"],
  me2pt5: ["ME: Ascended Heroes"],
  me3: ["ME03: Perfect Order"],
  neo1: ["Neo Genesis"],
  neo2: ["Neo Discovery"],
  neo3: ["Neo Revelation"],
  neo4: ["Neo Destiny"],
  np: ["Nintendo Promos"],
  pgo: ["Pokemon GO"],
  pl1: ["Platinum"],
  pl2: ["Rising Rivals"],
  pl3: ["Supreme Victors"],
  pl4: ["Arceus"],
  pop1: ["POP Series 1"],
  pop2: ["POP Series 2"],
  pop3: ["POP Series 3"],
  pop4: ["POP Series 4"],
  pop5: ["POP Series 5"],
  pop6: ["POP Series 6"],
  pop7: ["POP Series 7"],
  pop8: ["POP Series 8"],
  pop9: ["POP Series 9"],
  rsv10pt5: ["SV: White Flare"],
  ru1: ["Rumble"],
  si1: ["Southern Islands"],
  sm1: ["SM Base Set"],
  sm10: ["SM - Unbroken Bonds"],
  sm11: ["SM - Unified Minds"],
  sm115: ["Hidden Fates"],
  sm12: ["SM - Cosmic Eclipse"],
  sm2: ["SM - Guardians Rising"],
  sm3: ["SM - Burning Shadows"],
  sm35: ["Shining Legends"],
  sm4: ["SM - Crimson Invasion"],
  sm5: ["SM - Ultra Prism"],
  sm6: ["SM - Forbidden Light"],
  sm7: ["SM - Celestial Storm"],
  sm75: ["Dragon Majesty"],
  sm8: ["SM - Lost Thunder"],
  sm9: ["SM - Team Up"],
  sma: ["Hidden Fates: Shiny Vault"],
  smp: ["SM Promos"],
  sv1: ["SV01: Scarlet & Violet Base Set"],
  sv10: ["SV10: Destined Rivals"],
  sv2: ["SV02: Paldea Evolved"],
  sv3: ["SV03: Obsidian Flames"],
  sv3pt5: ["SV: Scarlet & Violet 151"],
  sv4: ["SV04: Paradox Rift"],
  sv4pt5: ["SV: Paldean Fates"],
  sv5: ["SV05: Temporal Forces"],
  sv6: ["SV06: Twilight Masquerade"],
  sv6pt5: ["SV: Shrouded Fable"],
  sv7: ["SV07: Stellar Crown"],
  sv8: ["SV08: Surging Sparks"],
  sv8pt5: ["SV: Prismatic Evolutions"],
  sv9: ["SV09: Journey Together"],
  sve: ["SVE: Scarlet & Violet Energies"],
  svp: ["SV: Scarlet & Violet Promo Cards"],
  swsh1: ["SWSH01: Sword & Shield Base Set"],
  swsh10: ["SWSH10: Astral Radiance"],
  swsh10tg: ["SWSH10: Astral Radiance Trainer Gallery"],
  swsh11: ["SWSH11: Lost Origin"],
  swsh11tg: ["SWSH11: Lost Origin Trainer Gallery"],
  swsh12: ["SWSH12: Silver Tempest"],
  swsh12pt5: ["Crown Zenith"],
  swsh12pt5gg: ["Crown Zenith: Galarian Gallery"],
  swsh12tg: ["SWSH12: Silver Tempest Trainer Gallery"],
  swsh2: ["SWSH02: Rebel Clash"],
  swsh3: ["SWSH03: Darkness Ablaze"],
  swsh35: ["Champion's Path"],
  swsh4: ["SWSH04: Vivid Voltage"],
  swsh45: ["Shining Fates"],
  swsh45sv: ["Shining Fates: Shiny Vault"],
  swsh5: ["SWSH05: Battle Styles"],
  swsh6: ["SWSH06: Chilling Reign"],
  swsh7: ["SWSH07: Evolving Skies"],
  swsh8: ["SWSH08: Fusion Strike"],
  swsh9: ["SWSH09: Brilliant Stars"],
  swsh9tg: ["SWSH09: Brilliant Stars Trainer Gallery"],
  swshp: ["SWSH: Sword & Shield Promo Cards"],
  tk1a: ["EX Trainer Kit 1: Latias & Latios"],
  tk1b: ["EX Trainer Kit 1: Latias & Latios"],
  tk2a: ["EX Trainer Kit 2: Plusle & Minun"],
  tk2b: ["EX Trainer Kit 2: Plusle & Minun"],
  xy0: ["Kalos Starter Set"],
  xy1: ["XY Base Set"],
  xy10: ["XY - Fates Collide"],
  xy11: ["XY - Steam Siege"],
  xy12: ["XY - Evolutions"],
  xy2: ["XY - Flashfire"],
  xy3: ["XY - Furious Fists"],
  xy4: ["XY - Phantom Forces"],
  xy5: ["XY - Primal Clash"],
  xy6: ["XY - Roaring Skies"],
  xy7: ["XY - Ancient Origins"],
  xy8: ["XY - BREAKthrough"],
  xy9: ["XY - BREAKpoint"],
  xyp: ["XY Promos"],
  zsv10pt5: ["SV: Black Bolt"],
};
