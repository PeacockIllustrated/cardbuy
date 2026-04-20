# PHASE 2 · Data Layer

> **Preview only.** Do not execute until the operator promotes this to active. Exists so Phase 1 decisions don't conflict with what's coming.

---

## Objective

Replace Phase 1's mocks with real data: Supabase schema, auth, and integrations with `pokemontcg.io` + `PokemonPriceTracker`. The wireframe's shape doesn't change — the data underneath it does.

---

## Scope

### Database
- Initialise Supabase project (dev + prod).
- Apply `SCHEMA.sql` (expect it to evolve during this phase).
- RLS policies on every table. No table ships without RLS enabled.
- Seed scripts for local dev.

### Auth
- Supabase Auth with email + magic link for sellers.
- Admin role flag on `cb_users.role = 'admin'`.
- Middleware gating `/admin/*` behind `role = 'admin'`.
- Remove the red `[ADMIN · no auth yet]` dev banner.

### External integrations
- **pokemontcg.io** — nightly Vercel cron pulls full card catalogue by set.
  - Upsert into `cb_cards`.
  - Store `raw_prices` JSONB as returned by the API (NM/LP/MP across holo variants).
  - Store image URL, rarity, set, number, printed total.
- **PokemonPriceTracker** — nightly cron for graded prices on high-value cards.
  - Start conservative — only fetch graded data for cards with `raw_prices.market > £10` to stay within free-tier credits.
  - Store `graded_prices` JSONB keyed by company + grade.
  - Store `sale_count_30d` as the confidence signal.
- Both crons run sequentially via a single `/api/cron/sync-prices` endpoint triggered by Vercel Cron.

### Mock replacement
- Delete `/lib/mock/mock-cards.ts` — replace with Supabase queries.
- Delete `/lib/mock/mock-submissions.ts` — replace with real submission writes.
- **Keep** `/lib/mock/mock-margin-config.ts` as the *default seed* for `cb_admin_margins` — the shape is identical, we're just persisting it.

### Caching
- All card lookups in seller-facing UI hit Supabase, not external APIs.
- Set-level queries use Next.js `fetch` cache with 1-hour revalidation.
- Admin catalogue page shows `last_synced` per card.

---

## What stays the same

- Every route from Phase 1 still exists at the same URL.
- Every component's prop shape stays the same — just the source of props changes.
- All annotation labels and TODO markers get removed as their items are completed. The wireframe stamp stays until Phase 5.

---

## Deliverables

- [ ] Supabase project provisioned and accessible
- [ ] `SCHEMA.sql` applied with RLS
- [ ] Seed script populating margin config + 1 test set of cards
- [ ] `/api/cron/sync-prices` route working against both APIs
- [ ] Vercel Cron configured (nightly at 04:00 UTC)
- [ ] Auth wired up — magic link flow works end-to-end
- [ ] All `/admin/*` routes protected
- [ ] Mock imports purged from the codebase (except margin config seed)
- [ ] `.env.example` lists every required variable
