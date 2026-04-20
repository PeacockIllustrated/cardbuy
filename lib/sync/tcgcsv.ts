import "server-only";

/**
 * Thin wrappers around TCGCSV's public Pokémon endpoints.
 *
 * Pokémon's category id on TCGplayer is 3 — every URL here is shaped
 * `https://tcgcsv.com/tcgplayer/3/<groupId>/...`. No auth needed; data
 * refreshes daily at 20:00 UTC.
 */

const BASE = "https://tcgcsv.com/tcgplayer/3";

export type TcgcsvGroup = {
  groupId: number;
  name: string;
  abbreviation: string;
  isSupplemental: boolean;
  publishedOn: string | null;
  modifiedOn: string;
  categoryId: number;
};

export type TcgcsvProductExtended = { name: string; value: string };

export type TcgcsvProduct = {
  productId: number;
  name: string;
  cleanName: string;
  imageUrl: string | null;
  categoryId: number;
  groupId: number;
  url: string;
  modifiedOn: string;
  extendedData: TcgcsvProductExtended[];
};

export type TcgcsvPriceRow = {
  productId: number;
  lowPrice: number | null;
  midPrice: number | null;
  highPrice: number | null;
  marketPrice: number | null;
  directLowPrice: number | null;
  subTypeName: string; // 'Normal' | 'Holofoil' | 'Reverse Holofoil' | …
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "cardbuy-sync/1.0" },
    // Disable Next's fetch cache — we always want the latest from TCGCSV.
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`TCGCSV ${res.status} ${res.statusText} for ${url}`);
  }
  return (await res.json()) as T;
}

export async function listGroups(): Promise<TcgcsvGroup[]> {
  const data = await fetchJson<{ results: TcgcsvGroup[] }>(`${BASE}/groups`);
  return data.results ?? [];
}

export async function listProducts(
  groupId: number,
): Promise<TcgcsvProduct[]> {
  const data = await fetchJson<{ results: TcgcsvProduct[] }>(
    `${BASE}/${groupId}/products`,
  );
  return data.results ?? [];
}

export async function listPrices(
  groupId: number,
): Promise<TcgcsvPriceRow[]> {
  const data = await fetchJson<{ results: TcgcsvPriceRow[] }>(
    `${BASE}/${groupId}/prices`,
  );
  return data.results ?? [];
}

/** Pull "Card Number" out of a product's extendedData; returns the
 *  printed number minus padding and "/total" suffix. */
export function extractCardNumber(p: TcgcsvProduct): string | null {
  const raw = p.extendedData.find((d) => d.name === "Number")?.value;
  if (!raw) return null;
  // "001/102" → "1"; "SV101" stays "SV101"; "TG12/TG30" → "TG12"
  const head = raw.split("/")[0];
  const stripped = head.replace(/^0+/, "") || head;
  return stripped;
}

export function extractRarity(p: TcgcsvProduct): string | null {
  return p.extendedData.find((d) => d.name === "Rarity")?.value ?? null;
}
