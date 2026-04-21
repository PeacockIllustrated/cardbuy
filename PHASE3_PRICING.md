# PHASE 3 · PRICING ENGINE

> Takes the buylist offer calculation off mock data and onto live
> TCGplayer market data. Wires the existing sync pipeline (which was
> scaffolded but never worked against real DB because of a schema/code
> mismatch) end-to-end, gets real prices into `lewis_card_prices`, and
> swaps `OfferBuilder` from mock to live.
>
> **Graded pricing is explicitly out of scope for Phase 3** (operator
> call 2026-04-21). Graded offers continue to use mock baselines until
> a graded data source is picked in a later phase.

---

## 00 · Status

Ready to execute. Checkpoints answered:

1. **Schema reconcile:** drop the unused `lewis_prices` / `lewis_prices_history` / `lewis_sync_runs` tables defined in migration 0005, create fresh ones with the column shape the application code already expects (`lewis_cards`, `lewis_card_prices`, `lewis_card_price_history`, `lewis_sync_runs`). Keep `lewis_card_tcg_map` — it's clean. **Only drops `lewis_`-prefixed tables** per operator instruction.
2. **Coverage:** extend beyond the current 6 Gen-1 sets. Treated as a separate ongoing workstream (Phase 3 ships the infra; set expansion is a drumbeat of fixture JSON additions after).
3. **Graded data source:** skip for v1.

---

## 01 · Goal

After this phase:
- Running a sync ingests TCGCSV's TCGplayer mirror into
  `lewis_card_prices` without schema errors.
- `OfferBuilder` on `/card/[id]` uses real USD market prices when a
  card has a price row, mock fallback when it doesn't, with the source
  labelled in the UI.
- FX rate auto-refreshes nightly against `open.er-api.com`, with
  admin manual override retained.
- The admin mapping-preview page can commit mappings to
  `lewis_card_tcg_map` so sync runs actually find cards.

---

## 02 · Non-goals (deferred)

- Graded card pricing (PokemonPriceTracker / PriceCharting / eBay).
  Graded offers stay mock-backed.
- eBay sold-listing integration for raw prices — TCGplayer market is
  enough for v1.
- Automatic confidence scoring based on sale volume (planned in the
  original brief). Kept simple: every live price row is treated as
  confident; low-quality data is a future concern.
- Historical price graphs on card detail pages.
- "Your card is worth more than it was" matchmaking signal (Slice C2
  completion) — needs price history trend detection, separate effort.

---

## 03 · Decision log

- **Schema:** drop 0005's divergent tables, rebuild clean in 0012.
- **Mapping:** stored in `lewis_card_tcg_map` (unchanged from 0005).
  Mapping preview writes rows via a new `commitMappings()` server
  action. `manual-override` rows are preserved across re-seeds.
- **Price fallback order for a card:**
  1. Live row matching exact variant (e.g. "1st Edition Holofoil")
  2. Any live row for the card (`pickHeadlinePrice` picks the highest-market variant)
  3. Mock price baseline
- **FX:** `lewis_admin_margins.fx_rate_usd_gbp` remains the source of
  truth. `fx_manual_override=true` disables auto-updates. Default OFF
  (auto-fetch takes effect).
- **Coverage:** not coupled to Phase 3 schema work. Sets are added by
  dropping JSON files into `pokemon-tcg-data/` + extending
  `PHASE3_SLICE1_SETS` aliases in `lib/pricing/tcgcsv.ts`.

---

## 04 · Slice sequence

### 3.A · Schema reconcile + mapping persistence (this slice)

- Migration `0012_phase3_pricing_reconcile.sql`:
  - `drop table if exists lewis_prices_history cascade` (kills its
    trigger + history from 0005)
  - `drop table if exists lewis_prices cascade`
  - `drop table if exists lewis_sync_runs cascade` (column shape is
    incompatible with code — losing empty audit history is acceptable)
  - `create table lewis_cards (…)` — catalogue cache the sync writes to
  - `create table lewis_card_prices (…)` — latest USD price per
    (card, source, variant). `unique (card_id, source, variant)` for
    upsert.
  - `create table lewis_card_price_history (…)` — daily snapshots.
    `unique (card_id, source, variant, snapshotted_on)` so re-running
    a sync the same day doesn't duplicate.
  - `create table lewis_sync_runs (…)` — rebuilt with the columns code
    writes: `kind`, `source`, `started_at`, `finished_at`, `status`,
    `sets_processed`, `cards_upserted`, `prices_upserted`, `errors`
    jsonb, `notes`.
  - RLS: authenticated read on `lewis_cards` + `lewis_card_prices`;
    admin-only write. `lewis_sync_runs` admin-read-only. History
    admin-read-only.
  - `set_updated_at` trigger on `lewis_cards` (reuses helper from 0001).

- New server action `commitMappingsForSet(setId)` in
  `app/_actions/admin.ts`:
  - Runs `buildMapping(setId)` server-side.
  - For each `exact`/`number-only`/`name-fuzzy` match, UPSERT into
    `lewis_card_tcg_map` with `source='auto'`.
  - Skips rows where `source='manual-override'` already exists.
  - Returns a count summary.

- `/admin/pricing/mapping-preview` gains a **Commit** button per set
  (and a "Commit all" above) that calls the server action and shows
  the result.

### 3.B · Wire OfferBuilder to real prices

- `app/(seller)/card/[id]/page.tsx` already calls
  `getLatestPricesForCard(id)`. Extend `OfferBuilder` to accept a live
  price override; when present, swap `computeMockOffer`'s baseline.
- Small source-of-truth chip: `price source: live (TCGplayer,
  updated 2h ago)` or `price source: mock (awaiting sync)`.
- Admin-only warning chip on cards where mapping is missing so Lewis
  can manually map outliers (e.g. Base Set Machamp's Shadowless
  group).

### 3.C · FX auto-fetch

- `app/api/cron/sync-fx/route.ts`:
  - Hits `https://open.er-api.com/v6/latest/USD`.
  - Updates `lewis_admin_margins.fx_rate_usd_gbp` +
    `fx_rate_eur_gbp` unless `fx_manual_override = true`.
  - Writes a `lewis_sync_runs` row with `kind='fx'`.
- `vercel.json` cron entry at 02:00 UTC (2h before sync-prices).
- Admin `/admin/pricing` page surfaces last fetch timestamp.

### 3.D · Set coverage extension (ongoing, separate)

- Not a code change — a content workstream.
- For each new set: drop the `pokemontcg.io` JSON into
  `pokemon-tcg-data/<set-id>.json`, extend `PHASE3_SLICE1_SETS` in
  `lib/pricing/tcgcsv.ts` with the matching TCGCSV group alias, run
  mapping-preview, commit, run sync.
- Suggested first-pass expansion after 3.A–C land:
  - Gym Heroes / Gym Challenge (`gym1`, `gym2`)
  - Neo series (`neo1`..`neo4`)
  - Legendary Collection (`base6`)

---

## 05 · Acceptance

- [ ] Migration 0012 applies clean against a DB that has 0005 applied.
- [ ] `pnpm typecheck` + `pnpm lint` + `pnpm build` all clean.
- [ ] Hitting "Commit mappings" on a set writes rows to
      `lewis_card_tcg_map` (visible via raw query).
- [ ] Running the sync after mapping commit produces `lewis_card_prices`
      rows for committed cards.
- [ ] A card with a live price shows it on `/card/[id]`; a card without
      one falls back to mock with a visible source label.
- [ ] FX cron updates `fx_rate_usd_gbp` when executed; no-op when
      `fx_manual_override = true`.
- [ ] `/admin/sync` reflects new runs.

---

## 06 · Risk register

- **Dropping live `lewis_sync_runs`** — any existing audit data in
  that table is lost. Acceptable: the table's columns don't match
  code, so any rows there are artefacts of partial application or
  manually-inserted test data, not production history.
- **Dropping `lewis_prices`, `lewis_prices_history`** — same logic;
  they can't have been populated by code.
- **TCGCSV downtime** during the first post-migration sync produces a
  `lewis_sync_runs` row with `status='failed'`. Retry via the admin
  button; no DB state corruption.
- **Rate limiting `open.er-api.com`** — free endpoint, no key. Cron
  runs once per day, well under their limits.
