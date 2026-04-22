# HANDOFF — session log & context primer

> Drop-in context document for a fresh Claude session. Read this
> alongside `CLAUDE.md` and the relevant phase brief(s). It captures
> the state of the codebase as of 2026-04-22, the decisions that got
> us here, and the threads that are still open.

---

## 1 · What's live right now

The cardbuy project has moved well beyond the Phase-1 wireframe and
Phase-5 brand pass that were signed off weeks ago. Major features
that are wired end-to-end against Supabase:

| Area | Status | Files / routes |
|------|--------|----------------|
| **Auth** | ✓ wired | `lewis_users`, magic-link + password (see `0001` + `0002` migrations) |
| **Submissions (buylist)** | ✓ persist | `/submission/*`, admin at `/admin/submissions`. `lewis_submissions` + `lewis_submission_items` |
| **Admin margin config** | ✓ editable | `/admin/pricing`, `lewis_admin_margins` with `lewis_admin_margins_history` audit |
| **TCGCSV sync pipeline** | ✓ runs | `app/api/cron/sync-prices`, nightly 04:00 UTC. Populates `lewis_cards`, `lewis_card_prices`, `lewis_card_price_history`, `lewis_sync_runs` |
| **FX auto-fetch** | ✓ runs | `app/api/cron/sync-fx`, nightly 02:00 UTC against `open.er-api.com`. Honours `fx_manual_override` |
| **Binder — persistence** | ✓ wired | `/binder`, `lewis_binder_entries` + `lewis_wishlist_entries`. Auth-gated |
| **Binder — graded scan** | ✓ wired | PSA-slab framed camera → `graded-scans` private bucket |
| **Binder — consent + deletion** | ✓ wired | `/settings`, granular GDPR toggles, hard delete |
| **Binder — admin matchmaking bridge** | ✓ wired | `/admin/demand`, `/admin/demand/[cardId]`, `/admin/sourcing` |
| **Shop persistence** | ✓ wired | `lewis_listings`, `lewis_orders`, `lewis_order_items`. Atomic `lewis_create_order` RPC with `FOR UPDATE` stock locking. Admin state machine at `/admin/orders/[ref]`. |
| **Shop → binder auto-add** | ✓ wired (Slice B2) | On order `delivered`, if `add_to_binder_opt_in = true`, items write to `lewis_binder_entries` with `source='shop_order'` |
| **Pricing — live price chip** | ✓ wired | `PriceSourceChip` on `/card/[id]` — LIVE (teal) / MOCK (yellow) / admin-only UNMAPPED warning |
| **Pricing — mapping persistence** | ✓ wired | `/admin/pricing/mapping-preview` → Commit button writes `lewis_card_tcg_map`, preserves `manual-override` rows |

Plus the non-functional work that gives the product its identity:
Phase-5 pop-art palette, pack-open centred overlay, type-specific
particle field on featured tiles (with mobile-tilt activation), 3D
binder page-flip + click-and-hold riffle, full-viewport
black→white pack transition.

---

## 2 · Phase briefs in the repo

Four of these sit in the repo root. Read the one relevant to your
task end-to-end before changing anything in that area.

- `CONCEPT_BINDER.md` — the original concept doc for the binder
  feature. Decisions re. granularity, consent, sharing.
- `PHASE6_BINDER.md` — persistence slice (A). References the later
  slices (B1 / B2 / C1 / C2 / D).
- `PHASE7_SHOP.md` — shop persistence. Includes the B2 piggyback.
- `PHASE3_PRICING.md` — pricing engine. Schema reconcile, mapping,
  FX, deferred graded data.

Not yet written as phase briefs (because we haven't picked them up):

- Phase 4 — submission lifecycle + PayPal payouts.
- Phase 8 — Stripe / transactional email / Royal Mail labels.
- Pack/Set view mode for the binder (see §6 "open threads").

---

## 3 · Decisions that are locked

These have been signed off by the operator. Treat them as invariants
unless explicitly overridden.

### Data / schema
- **DB prefix is `lewis_` not `cb_`** (per `MEMORY.md`). Every table,
  sequence, function, policy must be `lewis_`-prefixed. Overrides
  `CLAUDE.md` §04 which still says `cb_`.
- **Binder row granularity** — one row per
  `(user, card, variant, condition, grading_company, grade)` + a
  `quantity` column. NULLs-not-distinct on the unique constraint so
  raw rows with null grading fields collapse across inserts.
- **One Grail per user total** — enforced via partial unique index
  on `(user_id) where is_grail = true`. `setGrail(id, true)` clears
  any prior grail in the same transaction before setting.
- **Hard delete on account removal** — FK cascade chain from
  `auth.users` scrubs binder, wishlist, submissions, orders-buyer-link.
  No aggregate-data retention.
- **Wishlist key is `card_id`** — specific print, not dex number.
  Binder missing-slot wishlist targets the dex registry's
  `sampleCardId` for that slot.
- **Graded-card onboarding is the framed-camera flow** — see
  `MEMORY.md → project_graded_card_onboarding.md`. Passport-style
  viewfinder with PSA-slab aspect frame. File-upload stays as a
  fallback, never the primary.

### Payments / commerce
- **Stripe is stubbed.** Orders create at `status='pending_payment'`
  with `payment_method='stub'`. Checkout submit fires the RPC,
  navigates to order confirmation with a "Payments coming soon"
  modal. Real Stripe is Phase 8.
- **Stock reservation is on order creation, not cart-add.** Cart is
  client-only `localStorage` via `useSyncExternalStore`.
- **No TTL on pending-payment orders.** Admin cancels manually; the
  cancel trigger releases `qty_reserved`.
- **`addBinderEntry` on duplicate tuple = increment quantity**, not
  error.
- **Sell-this-card from the binder pre-fills the submission draft**
  via `?prefill_variant=…&prefill_condition=…&prefill_company=…&prefill_grade=…`
  read by the card-detail page and piped into `OfferBuilder`.
- **Graded duplicates prompt a confirm** in the add-copy drawer —
  "You already have a PSA 9 Charizard, add another?" before incrementing.

### Pricing
- **Graded pricing is explicitly out of scope for Phase 3.** Graded
  offers stay mock-backed until a data source is picked (future
  phase). Raw prices come from TCGCSV via the nightly sync.
- **FX manual override disables auto-fetch.** `fx_manual_override=true`
  short-circuits the FX cron to `status=skipped`.

### UI
- **Binder is dex-ordered**, not set-ordered, by default. Pack / set
  view is open (see §6).
- **Pack open flow is centre-screen overlay.** Not in-place on the
  tile. `router.push` fires 80ms before the white flash peaks so
  the destination renders under white — hand-off feels like a cut.
- **Card-meta block sits above the particle layer** (`relative z-[3]`
  on the listing tile's name/price block). Particles never cross the
  text.
- **Particles emit from the card perimeter** (not canvas edges),
  type-coloured glow applies to the starbursts via `filter:
  drop-shadow(var(--type-glow))`, not to each particle.
- **Pack tile has no per-tile `.pack-opening`** anymore — only the
  portal overlay does. Grid tile is just `PackFace` at rest.

---

## 4 · This session's changes

In addition to what's already in the commit log (`git log`), this
session shipped:

1. **Extended the Pokédex to the full national dex (1–1025)**.
   `NATIONAL_DEX` in `lib/fixtures/pokedex.ts` walks every Pokémon
   card in the 172-set fixture, picks the shortest-named entry per
   dex number as the canonical, fills any gap with `name: "???"`.
   No gaps exist in the current fixture — every national-dex entry
   from Bulbasaur through Pecharunt has a name. `GEN1_DEX` remains
   as an alias for any lingering imports.
2. **Side shelf for Trainer / Energy cards.** The binder page splits
   owned entries into Pokémon (feeds the dex grid) and everything
   else (feeds a shelf). Shelf lives in a new two-pane panel below
   the binder (`BottomShelfPanel` in `BinderPanel.tsx`) that
   mirrors the main binder's layout — detail pane on hover, card
   rail on the right.
3. **Region glossary.** `RegionTabs` above the binder with nine
   regions (Kanto → Paldea) plus "All". Clicking a region filters
   `filteredSlots` and pushes the page through the existing flip
   animation.
4. **Filter-as-flip.** Introduced `snapshotFrom` on `FlipState`.
   When a region changes, the previous page's slots are captured
   BEFORE state changes, and the flip runs with the snapshot as the
   outgoing overlay. The standard prev/next flip is unchanged.
5. **Live-filtered header counts.** Header shows counts for the
   active region, grid range shows the actual dex numbers on the
   visible page, empty-state heading flips between "National
   Pokédex" and the region name.

Earlier in the same working period (commits already on `main`):
dramatic pack-open centre-screen flow with black → white transition,
particles firing on mobile when the card's tilt engages, full dex
coverage, responsive mobile shelf variants (now replaced by the
bottom panel).

---

## 5 · Important caveats & gotchas

Things a new session could easily miss or get wrong.

### Fixture loading
- `pokemon-tcg-data/` has 172 JSON files. `getAllCards()` in
  `lib/fixtures/cards.ts` loads *all* of them — don't assume the
  project is Gen 1 only. The fixture covers every set from Base
  Set through Scarlet & Violet including promos, with ~20,000 cards.
- `lib/fixtures/cards.ts` is `"server-only"`. Client components can
  never import it directly. When a client component needs card data,
  the server page / action builds a plain-data payload (e.g.
  `BinderSlotPayload`, `EnrichedListing`) and passes it through props.

### CLAUDE.md is stale in places
- §03 says "Supabase deferred to Phase 2" — false, auth + several
  domains are live.
- §04 says DB prefix `cb_` — actually `lewis_`, see `MEMORY.md`.
- §07 says current phase is Phase 5 branding — we're well past that.
  Phase 6 (binder), Phase 7 (shop), Phase 3 (pricing) have all
  substantially shipped.

If you're tempted to cite CLAUDE.md for a rule, double-check against
`MEMORY.md` and the latest phase brief.

### Schema-code mismatches, once-burned
- Migration `0005_phase3_prices.sql` defined `lewis_prices`,
  `lewis_prices_history`, `lewis_sync_runs` with column shapes the
  code never used. `0012_phase3_pricing_reconcile.sql` drops those
  and creates `lewis_cards`, `lewis_card_prices`,
  `lewis_card_price_history`, and a correctly-shaped
  `lewis_sync_runs`. If you see references to `lewis_prices` in new
  code, it's wrong.
- `lewis_card_tcg_map` from `0005` is the one clean table; kept.

### Migrations
- All migrations are in `supabase/migrations/` numbered sequentially.
  Next free number is `0013`.
- Every migration is idempotent + non-destructive by convention —
  `create table if not exists`, `do $$` guards for triggers and
  policies, drops only within a clearly-scoped reconcile migration
  (like 0012).
- Only `lewis_`-prefixed objects get touched. Never alter shared
  `auth.*` or `storage.*` tables directly — use the triggers +
  policies pattern from `0001`.

### Patterns to follow
- **Server actions** live in `app/_actions/*.ts`, `"use server"`.
  No shared `getCurrentUser()` helper — every action calls
  `supabase.auth.getUser()` and redirects to `/login` inline.
  Manual input validation, no zod.
- **Admin-gated pages** live under `app/admin/*` and are role-gated
  by `lib/supabase/middleware.ts`. The `is_admin(auth.uid())` SQL
  helper (migration `0004`) is used inside RLS policies to avoid
  recursion.
- **Mock data** lives under `lib/mock/`. Phase 2 largely migrated
  away but some mock listings still drive `/shop` fallbacks in
  places where real data hasn't been seeded yet.
- **Particle system** — `components/cardbuy/particles/recipes.ts`.
  One shared motion recipe with per-type sprite + brand-tinted glow
  applied to starbursts (not per-particle). SVG icons are vendored
  into `public/icons/types/` from `partywhale/pokemon-type-icons`
  (MIT).

---

## 6 · Open threads (pick one if asked to keep going)

Ordered roughly by dependency / unlock value:

### A. Pack-mode binder view
Asked for but not built. The binder currently organises by national
dex. Add a toggle so the user can also organise by pack/set —
clicking a set shows the cards of that set in set-card-number order.
Dependencies: none, self-contained. Scope ≈ half a day. Should
probably ship alongside a set picker dropdown or sub-tab rail.

### B. Phase 8 · production readiness
- Real Stripe integration (checkout + webhook that flips
  `pending_payment → paid` and mirrors the binder auto-add).
- Transactional email (activates the deferred Slice C2 — wishlist
  stock-match notifications, delivered by email + logged in
  `lewis_matchmaking_events`).
- Royal Mail label generation / tracking webhook.
- Cron: auto-release abandoned reservations (pair with the TTL
  convo from Phase 7).

### C. Phase 4 · submission lifecycle
- Verify / revise workflow in the admin submission detail.
- PayPal Payouts integration for the cash-out side of buylist.
- Independent of Phase 8. Pick up when buylist volume warrants it.

### D. Graded pricing data source
Deferred from Phase 3. Needs a vendor pick (PokemonPriceTracker /
PriceCharting / eBay sold listings). Graded-offer math stays
mock-backed until this lands.

### E. Coverage extension for the sync pipeline
Right now the TCGCSV sync only hits 6 first-gen sets (the aliases in
`PHASE3_SLICE1_SETS`). Extending to cover more sets is a content
drumbeat, not code — add the TCGCSV alias + run mapping-preview +
commit. Do one era at a time.

### F. Polish items
- Matchmaking events audit table + email dedup (blocked on Phase 8
  email).
- `/admin/inventory` full CRUD UI (read-only today via
  `listAdminListings`).
- Delta calculation for the binder portfolio (needs
  `lewis_card_price_history` data to actually land from the sync).

---

## 7 · Conventions & style

- **Next.js 16 App Router, React 19, Tailwind 4** (brand tokens in
  `app/globals.css` via `@theme`).
- **No emojis in files** unless explicitly requested.
- **No new markdown files** unless the operator asks. Phase briefs
  and this file are the exceptions.
- **Small commits, per-phase.** See recent commit history for the
  expected cadence and message format. Commit message ends with the
  standard Co-Authored-By trailer.
- **Preview tooling** (`mcp__Claude_Preview__preview_start` /
  `preview_screenshot`) is flaky in this environment — the server
  starts then vanishes on any follow-up call. Fall back to
  `pnpm typecheck` + `pnpm build` for verification.
- **Session kickoff ritual** from `README.md`: when starting on the
  active phase, first respond with:
  > "Read `PHASE<N>_*.md` and confirm the scope back to me in 5
  > bullets before writing any code."

---

## 8 · Quick orientation map

```
app/
  (seller)/               seller-facing pages
    binder/               Pokédex binder · dex grid · shelf
    card/[id]/            card detail (OfferBuilder + BinderChipRow + PriceSourceChip)
    packs/                booster pack grid → opens to /search?set=
    search/               card search results
    settings/             GDPR consent + account deletion
    shop/                 shopfront — list, detail, cart, checkout, order
    submission/           buylist draft / submit / confirmation
  admin/                  role-gated admin tree
    demand/               wishlist demand aggregate + per-card drilldown
    inventory/            shop listing admin (read-only CRUD pending)
    orders/               shop order list + per-order state machine
    pricing/              margin config + mapping-preview + sync-preview
    sourcing/             "who owns this card" for outbound offers
    submissions/          buylist submission queue + per-submission review
    sync/                 sync runs dashboard + manual trigger
    users/                user admin
  _actions/               server actions grouped by domain
  api/cron/               Vercel cron endpoints (sync-prices, sync-fx)
components/
  cardbuy/                brand-aware feature components
    binder/               BinderPanel, BinderChipRow, GradedCardScanner
    particles/            ParticleField + per-type recipes
    shop/                 AddToBasketButton
lib/
  fixtures/               pokemontcg.io fixture loaders (server-only)
  mock/                   Phase-1 mock data (being phased out)
  prices/                 shared price types + helpers
  pricing/                TCGCSV mapping engine
  shop/                   cart store + listing adapter
  supabase/               server/browser/admin clients, Database type
  sync/                   price + fx sync orchestrators
supabase/migrations/      all SQL, numbered sequentially
pokemon-tcg-data/         fixture JSON (cards + sets)
public/icons/types/       vendored energy-type SVGs (MIT)
PHASE*_*.md               per-phase briefs
HANDOFF.md                this file
```

Pick up wherever makes sense. Good luck.
