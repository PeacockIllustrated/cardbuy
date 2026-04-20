"use server";

import { cache } from "react";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runPriceSync } from "@/lib/sync/sync-prices";

/**
 * Per-request reader for the latest snapshot row(s) in
 * `lewis_card_prices` for a single card. Returns `null` when the
 * sync hasn't covered this card yet — callers fall back to mock data.
 *
 * For V1, when a card has multiple variants priced (Normal +
 * Holofoil) we surface ALL variants and let the caller pick (usually
 * the highest market price wins as the "fair" baseline).
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

export const getLatestPricesForCard = cache(
  async (cardId: string): Promise<LivePriceRow[]> => {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("lewis_card_prices")
        .select("*")
        .eq("card_id", cardId);
      if (error || !data) return [];
      return data as LivePriceRow[];
    } catch {
      return [];
    }
  },
);

/** Pick the variant with the highest market price — that's the
 *  authoritative "fair" baseline for an unspecified condition.
 *  Async because this file is "use server"; every export must be async. */
export async function pickHeadlinePrice(
  rows: LivePriceRow[],
): Promise<LivePriceRow | null> {
  if (rows.length === 0) return null;
  return [...rows].sort(
    (a, b) => Number(b.price_market ?? 0) - Number(a.price_market ?? 0),
  )[0];
}

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

export async function getRecentSyncRuns(
  limit = 8,
): Promise<SyncRunSummary[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("lewis_sync_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(limit);
    return ((data as SyncRunSummary[] | null) ?? []);
  } catch {
    return [];
  }
}

/**
 * Admin-only: trigger the TCGCSV price sync immediately, server-side.
 * Reuses the same orchestration as the nightly Vercel cron — just
 * skips the HTTP boundary so we don't need to ship CRON_SECRET to
 * the browser.
 *
 * Admin gating: middleware already rejects non-admins on /admin/*.
 * We re-check here so calls from elsewhere can't leak access.
 */
export async function triggerPriceSync(): Promise<
  | {
      ok: true;
      runId: string;
      status: "success" | "partial" | "failed";
      setsProcessed: number;
      cardsUpserted: number;
      pricesUpserted: number;
      durationMs: number;
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: profile } = await supabase
    .from("lewis_users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if ((profile as { role?: string } | null)?.role !== "admin") {
    return { ok: false, error: "Admin only" };
  }

  try {
    const result = await runPriceSync();
    revalidatePath("/admin/sync");
    revalidatePath("/admin");
    return {
      ok: true,
      runId: result.runId,
      status: result.status,
      setsProcessed: result.setsProcessed,
      cardsUpserted: result.cardsUpserted,
      pricesUpserted: result.pricesUpserted,
      durationMs: result.durationMs,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function getCardCoverageStats(): Promise<{
  totalCards: number;
  withPrices: number;
  lastSyncAt: string | null;
}> {
  try {
    const supabase = await createClient();
    const [{ count: totalCards }, { count: withPrices }, { data: lastRun }] =
      await Promise.all([
        supabase.from("lewis_cards").select("id", { count: "exact", head: true }),
        supabase
          .from("lewis_card_prices")
          .select("card_id", { count: "exact", head: true }),
        supabase
          .from("lewis_sync_runs")
          .select("finished_at")
          .eq("status", "success")
          .order("finished_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
    return {
      totalCards: totalCards ?? 0,
      withPrices: withPrices ?? 0,
      lastSyncAt:
        (lastRun as { finished_at: string | null } | null)?.finished_at ?? null,
    };
  } catch {
    return { totalCards: 0, withPrices: 0, lastSyncAt: null };
  }
}
