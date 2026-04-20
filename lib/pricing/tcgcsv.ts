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
 * exact-match on group name. Unmatched sets return `null` — the
 * preview page surfaces these so the operator can adjust names.
 *
 * Expected names for first-gen verification (Phase 3 slice 1 scope):
 *   base1  → "Base Set"
 *   base2  → "Jungle"
 *   base3  → "Fossil"
 *   base4  → "Base Set 2"
 *   base5  → "Team Rocket"
 *   basep  → "Wizards Black Star Promos"
 */
export async function resolveGroupIds(
  sets: Record<string, string>,
): Promise<Record<string, number | null>> {
  const groups = await fetchGroups();
  const byName = new Map(
    groups.map((g) => [g.name.trim().toLowerCase(), g.groupId]),
  );
  const out: Record<string, number | null> = {};
  for (const [localId, tcgName] of Object.entries(sets)) {
    out[localId] = byName.get(tcgName.trim().toLowerCase()) ?? null;
  }
  return out;
}

/** The six set-name mappings we verify in Phase 3 slice 1. */
export const PHASE3_SLICE1_SETS: Record<string, string> = {
  base1: "Base Set",
  base2: "Jungle",
  base3: "Fossil",
  base4: "Base Set 2",
  base5: "Team Rocket",
  basep: "Wizards Black Star Promos",
};
