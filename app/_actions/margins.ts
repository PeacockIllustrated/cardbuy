"use server";

import { cache } from "react";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { MOCK_MARGIN_CONFIG } from "@/lib/mock/mock-margin-config";
import type { MockMarginConfig } from "@/lib/mock/types";
import type { LewisAdminMargins } from "@/lib/supabase/types";

/**
 * Margin config persistence for /admin/pricing.
 *
 * Single-row philosophy: there's exactly one live row in
 * `lewis_admin_margins` (we always read the most recent). Updates
 * happen via a snapshot-then-replace pattern — the trigger
 * `lewis_admin_margins_snapshot_trg` writes the OLD row into
 * `lewis_admin_margins_history` so we keep an audit trail.
 *
 * `OfferBuilder` and other consumers still take the legacy
 * `MockMarginConfig` shape; `toMockShape()` adapts the DB row so we
 * don't have to refactor every offer-math caller. The mock module is
 * the fallback when Supabase is unreachable or the table is empty.
 */

function rowToMockShape(row: LewisAdminMargins): MockMarginConfig {
  return {
    id: row.id,
    global_margin: Number(row.global_margin),
    min_buy_price: Number(row.min_buy_price),
    confidence_threshold: row.confidence_threshold,
    condition_multipliers: row.condition_multipliers,
    grade_multipliers: row.grade_multipliers,
    set_overrides: row.set_overrides,
    rarity_overrides: row.rarity_overrides,
    fx_rate_usd_gbp: Number(row.fx_rate_usd_gbp),
    fx_rate_updated_at:
      row.fx_rate_updated_at ?? new Date().toISOString(),
    fx_manual_override: row.fx_manual_override,
  };
}

/**
 * Read the live margin config. Returns the legacy `MockMarginConfig`
 * shape so existing offer-math callers don't need refactoring.
 *
 * Wrapped in React's `cache()` so multiple components in the same
 * render dedupe to a single Supabase round-trip. We deliberately
 * don't use `unstable_cache` because the underlying Supabase server
 * client reads cookies, which Next 16 forbids inside cached scopes.
 *
 * Falls back to the in-repo seed if the table doesn't exist yet
 * (e.g. before migration 0003 has been applied).
 */
const fetchLiveConfig = cache(async (): Promise<MockMarginConfig> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("lewis_admin_margins")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return MOCK_MARGIN_CONFIG;
    return rowToMockShape(data as LewisAdminMargins);
  } catch {
    return MOCK_MARGIN_CONFIG;
  }
});

export async function getMarginConfig(): Promise<MockMarginConfig> {
  return fetchLiveConfig();
}

/**
 * Convenience: also expose the raw DB row (with extras like
 * `created_at` + `change_note`) for the admin pricing page.
 */
export async function getLiveMarginRow(): Promise<LewisAdminMargins | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lewis_admin_margins")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as LewisAdminMargins | null) ?? null;
}

export type MarginConfigInput = {
  global_margin: number;
  min_buy_price: number;
  confidence_threshold: number;
  condition_multipliers: Record<string, number>;
  grade_multipliers: Record<string, Record<string, number>>;
  set_overrides: Array<{
    set_id: string;
    set_name: string;
    margin: number;
    active: boolean;
  }>;
  rarity_overrides: Array<{
    rarity: string;
    margin: number;
    active: boolean;
  }>;
  fx_rate_usd_gbp: number;
  fx_rate_eur_gbp: number;
  fx_manual_override: boolean;
  change_note?: string;
};

/**
 * Admin-only: update the live config. The history trigger snapshots
 * the previous row automatically. RLS rejects non-admins.
 */
export async function updateMarginConfig(input: MarginConfigInput): Promise<{
  ok: boolean;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  // Find the current live row id (we update in place so the history
  // trigger fires with `old.*` populated).
  const { data: live } = await supabase
    .from("lewis_admin_margins")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const liveId = (live as { id: string } | null)?.id;

  const payload = {
    global_margin: input.global_margin,
    min_buy_price: input.min_buy_price,
    confidence_threshold: input.confidence_threshold,
    condition_multipliers: input.condition_multipliers,
    grade_multipliers: input.grade_multipliers,
    set_overrides: input.set_overrides,
    rarity_overrides: input.rarity_overrides,
    fx_rate_usd_gbp: input.fx_rate_usd_gbp,
    fx_rate_eur_gbp: input.fx_rate_eur_gbp,
    fx_rate_updated_at: new Date().toISOString(),
    fx_manual_override: input.fx_manual_override,
    created_by: user.id,
    change_note: input.change_note ?? null,
  };

  if (liveId) {
    const { error } = await supabase
      .from("lewis_admin_margins")
      .update(payload)
      .eq("id", liveId);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("lewis_admin_margins")
      .insert(payload);
    if (error) return { ok: false, error: error.message };
  }

  // Revalidate every page that reads margins. React's per-request
  // `cache()` clears between requests anyway, so no tag-bust needed.
  revalidatePath("/admin/pricing");
  revalidatePath("/card/[id]", "page");

  return { ok: true };
}
