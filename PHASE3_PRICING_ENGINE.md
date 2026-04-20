# PHASE 3 · Pricing Engine

> **Preview only.** Do not execute until promoted.

---

## Objective

Implement the real offer calculation that turns raw card prices + admin config into seller-facing offers. This is Lewis's business logic — the whole reason to own the platform rather than rent Storepass.

---

## Core formula

```ts
function calculateOffer({
  card,             // cb_cards row with raw_prices / graded_prices / sale_count_30d
  variant,          // 'raw' | 'graded'
  condition,        // 'NM' | 'LP' | 'MP' | 'HP' | 'DMG'  (if raw)
  gradingCompany,   // 'PSA' | 'CGC' | 'BGS' | 'SGC' | 'ACE'  (if graded)
  grade,            // '10' | '9' | ...  (if graded)
  quantity,
  config,           // cb_admin_margins snapshot
  fxRate,           // USD → GBP, fresh
}): OfferResult {
  const baseUSD = variant === 'raw'
    ? card.raw_prices.market
    : card.graded_prices[gradingCompany][grade];

  const baseGBP = baseUSD * fxRate;

  const conditionMult = variant === 'raw'
    ? config.condition_multipliers[condition]
    : 1; // graded cards skip condition multiplier

  const setOverride = config.set_overrides[card.set_id]?.active
    ? config.set_overrides[card.set_id].margin
    : config.global_margin;

  const rarityOverride = config.rarity_overrides[card.rarity]?.active
    ? config.rarity_overrides[card.rarity].margin
    : setOverride;

  const finalMargin = rarityOverride;

  const offerPerUnit = baseGBP
    * conditionMult
    * finalMargin;

  const confidence = card.sale_count_30d >= config.confidence_threshold
    ? 'high'
    : card.sale_count_30d > 0 ? 'low' : 'none';

  return {
    offerGBP: Math.max(offerPerUnit, config.min_buy_price),
    breakdown: { baseGBP, conditionMult, finalMargin, fxRate },
    confidence,
    requiresManualReview: confidence !== 'high',
    lineTotal: offerPerUnit * quantity,
  };
}
```

---

## Scope

### Admin panel wiring
- `/admin/pricing` edits persist to `cb_admin_margins`.
- A single "save" updates the whole config atomically — no partial updates.
- Changes are versioned (audit trail in `cb_admin_margins_history`).

### Offer display
- Every seller-facing offer now shows the real breakdown from the formula above.
- Confidence badge is live (high / low / none).
- Low-confidence offers include `[Manual review — actual offer may vary]`.

### Offer freshness
- Offers shown in `/submission` (cart) recompute on every page view.
- When Lewis changes config, a notification shows on any active seller's cart: `[Offers updated — review before submitting]`.
- Submitted offers (`cb_submission_items.offered_amount`) freeze at submit time — they are the contract. Audit row records which config version was used.

### FX
- `open.er-api.com` free endpoint, cron-refreshed 4× daily.
- Fallback to last cached value if the API is down.
- Admin can manually override FX if needed (e.g. during a sharp move).

### Confidence floor
- Cards with `sale_count_30d < threshold` fall back to:
  1. If `raw_prices.market` exists: use it with a `×0.6` confidence discount.
  2. Otherwise: show `[No current offer — contact us]`.

### Edge cases to handle
- Card with no graded price data but graded selected → show `[No data for this grade — pick a different grade or contact us]`.
- Card with stale data (`last_synced > 14 days`) → show a subtle stale indicator.
- Bulk / common cards — a separate flat-rate bulk buylist to avoid per-card lookups below £0.50.

---

## Deliverables

- [ ] `lib/pricing/calculate-offer.ts` with the core formula
- [ ] `lib/pricing/fx.ts` with cached + fallback FX
- [ ] `/admin/pricing` fully persisting + versioning
- [ ] All seller-facing offers using the real engine
- [ ] Confidence indicators live
- [ ] Unit tests covering: raw card, graded card, set override, rarity override, min price floor, low confidence fallback, FX fallback
