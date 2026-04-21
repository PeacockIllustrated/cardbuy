import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Phase 3 · Slice C · FX rate sync.
 *
 * Fetches USD→{GBP,EUR} rates from open.er-api.com (free, no API key,
 * generous limits — more than enough for one cron/day) and updates
 * `lewis_admin_margins.fx_rate_usd_gbp` / `fx_rate_eur_gbp` unless
 * `fx_manual_override = true`.
 *
 * The margins table has an UPDATE trigger that snapshots the OLD row
 * into `lewis_admin_margins_history` on every change, so we get a
 * full audit trail of FX changes for free.
 *
 * Writes a `lewis_sync_runs` row with `kind='fx'` so the admin panel
 * can show FX fetch history alongside price syncs.
 */

const SOURCE = "open.er-api";
const ENDPOINT = "https://open.er-api.com/v6/latest/USD";

export type FxSyncResult = {
  runId: string;
  status: "success" | "skipped" | "failed";
  usdGbp?: number;
  usdEur?: number;
  durationMs: number;
  reason?: string;
};

type OpenExchangeResponse = {
  result?: string;
  rates?: Record<string, number>;
  "error-type"?: string;
};

export async function runFxSync(): Promise<FxSyncResult> {
  const started = Date.now();
  const supabase = createAdminClient();

  const { data: run } = await supabase
    .from("lewis_sync_runs")
    .insert({ kind: "fx", source: SOURCE, status: "running" })
    .select("id")
    .single();
  const runId = (run as { id: string } | null)?.id ?? "(no run row)";

  try {
    const { data: margins, error: mErr } = await supabase
      .from("lewis_admin_margins")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (mErr) throw new Error(`Failed to read margins: ${mErr.message}`);
    if (!margins) {
      await closeRun(runId, "failed", {
        errors: [{ reason: "No margin config row" }],
      });
      return {
        runId,
        status: "failed",
        durationMs: Date.now() - started,
        reason: "No margin config row",
      };
    }

    if (margins.fx_manual_override) {
      await closeRun(runId, "success", {
        notes: "Skipped: fx_manual_override=true",
      });
      return {
        runId,
        status: "skipped",
        durationMs: Date.now() - started,
        reason: "Manual override active",
      };
    }

    const res = await fetch(ENDPOINT, { cache: "no-store" });
    if (!res.ok) throw new Error(`open.er-api responded ${res.status}`);
    const json = (await res.json()) as OpenExchangeResponse;
    if (json.result !== "success") {
      throw new Error(
        `open.er-api returned result=${json.result ?? "unknown"}${
          json["error-type"] ? ` (${json["error-type"]})` : ""
        }`,
      );
    }

    const gbp = json.rates?.GBP;
    const eur = json.rates?.EUR;
    if (typeof gbp !== "number") {
      throw new Error("GBP rate missing from response");
    }

    const nextEur =
      typeof eur === "number" ? eur : Number(margins.fx_rate_eur_gbp);

    const { error: updErr } = await supabase
      .from("lewis_admin_margins")
      .update({
        fx_rate_usd_gbp: gbp,
        fx_rate_eur_gbp: nextEur,
        fx_rate_updated_at: new Date().toISOString(),
      })
      .eq("id", margins.id);
    if (updErr) throw new Error(`Failed to update margins: ${updErr.message}`);

    await closeRun(runId, "success", {
      notes: `USD→GBP ${gbp.toFixed(4)}${
        typeof eur === "number" ? `, USD→EUR ${eur.toFixed(4)}` : ""
      }`,
    });

    return {
      runId,
      status: "success",
      usdGbp: gbp,
      usdEur: typeof eur === "number" ? eur : undefined,
      durationMs: Date.now() - started,
    };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    await closeRun(runId, "failed", { errors: [{ reason }] });
    return {
      runId,
      status: "failed",
      durationMs: Date.now() - started,
      reason,
    };
  }
}

async function closeRun(
  runId: string,
  status: "success" | "failed",
  extras: { notes?: string; errors?: Array<{ reason: string }> },
): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("lewis_sync_runs")
    .update({
      finished_at: new Date().toISOString(),
      status,
      ...(extras.notes ? { notes: extras.notes } : {}),
      ...(extras.errors ? { errors: extras.errors } : {}),
    })
    .eq("id", runId);
}
