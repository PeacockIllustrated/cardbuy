/**
 * Types + pure helpers for live price data. Kept in a plain module
 * (not a "use server" file) so sync helpers like `pickHeadlinePrice`
 * don't need to pretend they're async server actions.
 */

export type LivePriceRow = {
  card_id: string;
  source: "tcgplayer" | "cardmarket";
  variant: string;
  currency: "USD" | "EUR" | string;
  price_low: number | null;
  price_mid: number | null;
  price_market: number | null;
  price_high: number | null;
  source_updated_at: string | null;
  fetched_at: string;
};

export type SyncRunSummary = {
  id: string;
  kind: string;
  source: string | null;
  started_at: string;
  finished_at: string | null;
  status: "running" | "success" | "partial" | "failed";
  sets_processed: number;
  cards_upserted: number;
  prices_upserted: number;
  errors: Array<{ group?: string; reason: string }>;
  notes: string | null;
};

/** Pick the variant with the highest market price — that's the
 *  authoritative "fair" baseline for an unspecified condition. */
export function pickHeadlinePrice(rows: LivePriceRow[]): LivePriceRow | null {
  if (rows.length === 0) return null;
  return [...rows].sort(
    (a, b) => Number(b.price_market ?? 0) - Number(a.price_market ?? 0),
  )[0];
}
