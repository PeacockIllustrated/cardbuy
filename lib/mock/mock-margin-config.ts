import type { MockMarginConfig } from "./types";

/**
 * Mirrors `cb_admin_margins` in SCHEMA.sql so Phase 2 can swap to a real row.
 * Every value here is a Lewis-facing dial in the /admin/pricing wireframe.
 */
export const MOCK_MARGIN_CONFIG: MockMarginConfig = {
  id: "mock-margin-2026-04",
  global_margin: 0.55,
  min_buy_price: 0.5,
  confidence_threshold: 3,

  condition_multipliers: {
    NM: 1.0,
    LP: 0.85,
    MP: 0.65,
    HP: 0.45,
    DMG: 0.25,
  },

  grade_multipliers: {
    PSA: { "10": 1.0, "9": 0.6, "8": 0.35, "7": 0.2 },
    CGC: { "10": 0.95, "9.5": 0.7, "9": 0.5, "8.5": 0.3 },
    BGS: { "10": 1.0, "9.5": 0.75, "9": 0.5 },
    SGC: { "10": 0.85, "9": 0.5, "8": 0.3 },
    ACE: { "10": 0.9, "9": 0.55 },
  },

  set_overrides: [
    { set_id: "ssa", set_name: "Sample Set Alpha", margin: 0.7, active: true },
    { set_id: "ssd", set_name: "Sample Set Delta", margin: 0.45, active: false },
  ],

  rarity_overrides: [
    { rarity: "Common", margin: 0.3, active: true },
    { rarity: "Secret Rare", margin: 0.65, active: true },
  ],

  fx_rate_usd_gbp: 0.79,
  fx_rate_updated_at: "2026-04-19T06:00:00.000Z",
  fx_manual_override: false,
};
