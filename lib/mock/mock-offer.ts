import type {
  Condition,
  Grade,
  GradingCompany,
  MockCard,
  MockMarginConfig,
} from "./types";

/**
 * MOCK pricing formula for Phase 1 only. The real engine lives in Phase 3.
 *
 * offer_gbp = baseline_usd * fx * conditionOrGradeMultiplier * effectiveMargin
 * effectiveMargin = active rarity_override ?? active set_override ?? global_margin
 *
 * Returns a breakdown the UI can render verbatim.
 */
export type OfferBreakdown = {
  baselineUsd: number;
  baselineGbp: number;
  fx: number;
  multiplierLabel: string;
  multiplier: number;
  marginLabel: string;
  margin: number;
  offerGbp: number;
  saleCount: number;
  belowMin: boolean;
  lowConfidence: boolean;
};

export type OfferInput =
  | { variant: "raw"; condition: Condition }
  | { variant: "graded"; company: GradingCompany; grade: Grade };

export function computeMockOffer(
  card: MockCard,
  input: OfferInput,
  config: MockMarginConfig
): OfferBreakdown {
  let baselineUsd = 0;
  let multiplier = 1;
  let multiplierLabel = "";
  let saleCount = 0;

  if (input.variant === "raw") {
    const r = card.raw_prices[input.condition];
    baselineUsd = r?.market ?? 0;
    saleCount = r?.sale_count ?? 0;
    multiplier = config.condition_multipliers[input.condition] ?? 0;
    multiplierLabel = `Condition ${input.condition} ×${multiplier.toFixed(2)}`;
  } else {
    const g = card.graded_prices[input.company]?.[input.grade];
    baselineUsd = g?.market ?? 0;
    saleCount = g?.sale_count ?? 0;
    multiplier = config.grade_multipliers[input.company]?.[input.grade] ?? 0;
    multiplierLabel = `${input.company} ${input.grade} ×${multiplier.toFixed(2)}`;
  }

  const rarityOverride = config.rarity_overrides.find(
    (o) => o.active && o.rarity === card.rarity
  );
  const setOverride = config.set_overrides.find(
    (o) => o.active && o.set_id === card.set_id
  );
  const margin = rarityOverride?.margin ?? setOverride?.margin ?? config.global_margin;
  const marginLabel = rarityOverride
    ? `Rarity margin ×${margin.toFixed(2)}`
    : setOverride
      ? `Set margin ×${margin.toFixed(2)}`
      : `Global margin ×${margin.toFixed(2)}`;

  const baselineGbp = baselineUsd * config.fx_rate_usd_gbp;
  const offerGbpRaw = baselineGbp * multiplier * margin;
  const belowMin = offerGbpRaw < config.min_buy_price;
  const lowConfidence = saleCount < config.confidence_threshold;
  const offerGbp = belowMin ? 0 : +offerGbpRaw.toFixed(2);

  return {
    baselineUsd: +baselineUsd.toFixed(2),
    baselineGbp: +baselineGbp.toFixed(2),
    fx: config.fx_rate_usd_gbp,
    multiplierLabel,
    multiplier,
    marginLabel,
    margin,
    offerGbp,
    saleCount,
    belowMin,
    lowConfidence,
  };
}

export function formatGBP(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}
