import { getMarginConfig, getLiveMarginRow } from "@/app/_actions/margins";
import { PricingForm } from "./PricingForm";
import { FxSyncButton } from "./FxSyncButton";

/**
 * Server wrapper — fetches the live margin config (and the raw row,
 * for last-saved timestamp + EUR FX) and hands it to the client form.
 *
 * Admin gating happens in `middleware.ts`; we don't re-check here.
 */
export default async function AdminPricingPage() {
  const [config, row] = await Promise.all([
    getMarginConfig(),
    getLiveMarginRow(),
  ]);

  return (
    <div className="px-4 py-6 max-w-[1200px] mx-auto flex flex-col gap-4">
      <FxSyncButton
        lastUpdatedAt={row?.fx_rate_updated_at ?? null}
        manualOverride={row?.fx_manual_override ?? false}
      />
      <PricingForm
        initial={config}
        lastSavedAt={row?.created_at ?? null}
        initialFxEurGbp={row ? Number(row.fx_rate_eur_gbp) : 0.85}
      />
    </div>
  );
}
