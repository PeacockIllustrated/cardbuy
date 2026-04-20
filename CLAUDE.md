# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> This file is the root context for every Claude Code session on this repository. Read it end-to-end before doing anything. Do not deviate from the conventions or scope defined here without explicit instruction.

---

## 00 · Commands & environment

**Environment**
- Windows host, repo path under OneDrive: `C:\Users\peaco\OneDrive\Creative Cloud Files\Documents\GitHub\cardbuy`.
- Use bash (Unix) syntax — forward slashes, `/dev/null`, etc. Not PowerShell.
- OneDrive sync can occasionally race with `node_modules` writes. If you see file-lock errors during install/build, retry; if it persists, flag it.
- Repo is **not yet a git repository**. `git init` early per `README.md` before the first commit.

**First-run scaffold (repo currently has no `package.json`)**
```bash
pnpm create next-app@latest . --typescript --tailwind --app --src-dir=false --import-alias="@/*" --eslint
```

**After scaffold (add `typecheck` to `package.json` scripts):**
```bash
pnpm dev          # local dev server (http://localhost:3000)
pnpm build        # production build
pnpm lint         # eslint
pnpm typecheck    # tsc --noEmit
```

No test runner is specified for Phase 1. Defer the test-tooling choice until Phase 2.

**Session kickoff ritual** (from `README.md`): when starting work on the active phase, first respond with:
> "Read `PHASE<N>_*.md` and confirm the scope back to me in 5 bullets before writing any code."

---

## 01 · Project

**Working codename:** `cardbuy` *(final brand TBC — all branding is deferred)*
**Client:** Lewis, via Peacock Solutions
**One-liner:** The online front-door for Lewis's Pokémon TCG business — sellers get instant offers and post cards in (the **buylist** side), and buyers browse Lewis's curated stock and check out (the **shopfront** side).

**This is NOT:**
- a peer-to-peer marketplace (eBay, Cardmarket — there is exactly one merchant: Lewis)
- a grading service
- a live-auction tool

**This IS:**
- a single-merchant tool with two flows:
  - **buylist** — Lewis quotes sellers algorithmically, ships in, pays out
  - **shopfront** — Lewis lists individual physical inventory units for sale, customers buy and pay in
- UK-first, GBP-first
- margin-driven on the buy side (Lewis tunes buy prices via dials, not per-card edits)
- inventory-driven on the sell side (every listing is a real piece of stock with a SKU, condition, price, and "featured" flag for homepage promotion)

**Spiritual reference:** `buylist.randcards.com` (UK, Pokémon-focused) for the buy side; conventional TCG storefronts (TCGplayer, Card Cavern) for the shopfront — but unified into one cardbuy-branded experience.

**Product redefinition log:**
- *2026-04-19* — original brief was buylist-only; expanded to dual-sided (buy + sell) at operator's instruction. Mid-Phase-1 amendment captured in [PHASE1_WIREFRAME.md](PHASE1_WIREFRAME.md) bottom section.

---

## 02 · Who's building this and how

This is **spec-first agentic development**. The operator (Michael / Peacock Solutions) writes specs, reviews architecture, and drives the build. Claude Code executes against phase prompts. Every phase has a prompt file in the repo root (`PHASE1_*.md`, `PHASE2_*.md`, etc.). **Do not jump ahead.** If the current phase is P1, do not write Supabase code, API integrations, or pricing math. Those belong to later phases.

**Operating principles:**
1. **Scope discipline.** If a phase prompt doesn't ask for it, don't build it.
2. **Mocks before integrations.** Fake the data until the phase that explicitly replaces mocks with real sources.
3. **Raw data, computed offers (buy side).** Card prices are stored raw. Margins, multipliers, and FX are applied at read time, never persisted into card prices.
4. **Per-listing prices (sell side).** Shopfront prices are set per individual inventory unit (`cb_listings.price_gbp`). Lewis can seed defaults from market data + a sell-margin dial, but the listed price is the authoritative number once set.
5. **The admin panel is the product.** Every pricing decision (buy margins, sell margins, featured slots, inventory levels) is a dial Lewis can turn — no hardcoded numbers in business logic.
6. **Confidence over precision.** A buy offer based on 2 eBay sales is suspect. Expose sale counts and flag low-confidence cards rather than pretending we have a clean number.
7. **One catalogue, two flows.** `cb_cards` is the shared catalogue. Buylist offers and shopfront listings both reference card IDs but otherwise operate independently — a card can be quoted-for-buy without being for-sale, and vice versa.

---

## 03 · Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16** (App Router) | TypeScript strict. (Spec originally said 14; scaffolded with `@latest` Apr 2026.) |
| React | **React 19** | Bundled with Next 16. |
| Styling | **Tailwind CSS 4** | Phase 5+ pop-art palette in `app/globals.css` via `@theme`. Phase 1's grayscale lockdown was lifted on phase promotion. |
| Display type | **Archivo Black** (`next/font/google`) | Heavy condensed grotesque (single weight 900). All-caps for headings, CTAs, big prices. |
| Body type | **Inter** (`next/font/google`) | Workhorse sans. Weights `400`/`500`/`700`. Tabular numerals enabled for prices/stock. |
| Database | **Supabase** (Postgres + Auth + Storage) | Deferred to Phase 2 |
| Hosting | **Vercel** | Cron jobs for price syncs |
| Card data | **pokemontcg.io** | Deferred to Phase 2 |
| Graded prices | **PokemonPriceTracker** | Deferred to Phase 2 |
| FX | **open.er-api.com** (free) | Deferred to Phase 3 |
| Payments out | **PayPal Payouts** | Deferred to Phase 4 |
| State | **Zustand** for client-side cart/submission state | Add when needed |
| Icons | **Lucide** | Phase 1: avoid — use text labels to keep wireframe naked |

**Node / package manager:** pnpm 10+, Node 20+ (scaffolded with Node 22).

---

## 04 · Naming conventions

- **Repo:** `cardbuy` *(rename when brand is set)*
- **DB prefix:** `cb_` on every table (e.g. `cb_cards`, `cb_submissions`)
- **Submission reference format:** `CB-YYYY-NNNNNN` (e.g. `CB-2026-000042`)
- **Routes:** App Router conventions. Seller-facing lives under `/`, admin under `/admin/*`.
- **Components:** PascalCase, colocated with routes when single-use, `/components/ui/*` for primitives, `/components/*` for app-level.
- **Server actions:** `/app/_actions/*` with `'use server'`.
- **Env vars:** `NEXT_PUBLIC_*` for client, everything else server-only.

---

## 05 · Target architecture (reference, not P1 scope)

```
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│  pokemontcg.io   │   │  PokemonPriceTrk │   │  open.er-api.com │
│  (catalogue)     │   │  (graded / eBay) │   │  (USD→GBP FX)    │
└────────┬─────────┘   └────────┬─────────┘   └────────┬─────────┘
         │                      │                      │
         └──────────────────────┼──────────────────────┘
                                ▼
                   ┌─────────────────────────┐
                   │  Vercel Cron (nightly)  │
                   │  normalise · merge · ↓  │
                   └────────────┬────────────┘
                                ▼
                   ┌─────────────────────────┐
                   │  Supabase — raw prices  │
                   │  cb_cards, cb_prices    │
                   └─────┬───────────────┬───┘
                         │               │
             ┌───────────▼────┐   ┌──────▼─────────────┐
             │  Seller UI     │   │  Admin · Lewis's   │
             │  (buylist)     │   │  margin dials      │
             └────────────────┘   └────────────────────┘
```

**Pricing formula (Phase 3 target):**
```
offerGBP = ebaySoldAvgUSD
         × fxRate(USD→GBP)
         × conditionMultiplier
         × setMultiplier
         × rarityMultiplier
         × globalBuyMargin
```

All six inputs are Lewis-editable from the admin panel. The card's row in Supabase holds only the raw USD sold average and sale count — nothing else.

---

## 06 · Data model (reference, built in Phase 2)

See `SCHEMA.sql` for the target shape. Headline tables:

- `cb_cards` — canonical Pokémon card catalogue (id, name, set, number, rarity, image_url, sale_count)
- `cb_prices` — denormalised latest prices (raw by condition, graded by company + grade)
- `cb_submissions` — a seller's submission package
- `cb_submission_items` — individual cards within a submission with agreed offer
- `cb_admin_margins` — global + per-set + per-rarity margin config
- `cb_condition_multipliers` — NM/LP/MP/HP/DMG multipliers
- `cb_users` — Supabase Auth extension

---

## 07 · Current phase

**→ PHASE 5 · BRANDING** *(read `PHASE5_BRANDING.md`)*

Phase 1 wireframe (incl. shopfront amendment) is signed off and feature-complete. Phase 5 was promoted ahead of Phases 2–4 by operator decision (2026-04-19) so Lewis sees the brand against the IA before data wiring locks in shapes.

Phase 5 applies a **pop-art brand system** (saturated 3-colour palette, chunky display sans, thick-outlined "sticker" cards) over the existing routes — no IA changes, no new pages. Mock data still backs everything; auth, real prices, and payments remain TODO.

**Required reading at session start (in order):**
1. This file (`CLAUDE.md`) — top to bottom.
2. The active phase prompt (`PHASE5_BRANDING.md`) — top to bottom.
3. `PHASE5_BRANDING_REFERENCES.md` — the inspiration captured before promotion.
4. `PHASE1_WIREFRAME.md` (incl. mid-phase amendment) — the IA the brand is clothing.

Phases not yet started (still queued, in this order):
- `PHASE2_DATA_LAYER.md` — Supabase schema, auth, API integrations, mock → real data swap
- `PHASE3_PRICING_ENGINE.md` — margin dials, offer calculation, confidence scoring
- `PHASE4_SUBMISSION_LIFECYCLE.md` — shipping labels, verification UI, PayPal payouts, Stripe in (not yet written)

---

## 08 · Anti-patterns

Things that have burned previous projects. Do not do these:

- ❌ **Silent scope creep.** If a phase prompt doesn't ask for it, ask before building it.
- ❌ **Hardcoded pricing anywhere in logic files.** All pricing is config-driven from day one, even if the config is a TypeScript constant during Phase 1.
- ❌ **Mock data scattered across components.** All mocks live in `/lib/mock/*` with clear filenames (`mock-cards.ts`, `mock-submissions.ts`) for easy find-and-replace in Phase 2.
- ❌ **Persisting computed offers.** An offer shown to a seller is always recomputed from the raw price + current margins. Storing a historical offer is fine (for audit) — storing it *instead* of the raw inputs is not.
- ❌ **Using real card images or card data** (copyright). Phase 1 uses placeholder rectangles labelled `[CARD IMAGE]`.
- ❌ **Branding decisions.** No colours beyond grayscale, no logos, no fancy fonts, no rounded corners beyond 2px, no gradients, no shadows beyond a 1px hairline border.

---

## 09 · How to work with the operator

- Respond in clear technical prose, not marketing language.
- When unsure between two architectural paths, propose both with trade-offs and ask — do not silently pick.
- Flag assumptions explicitly at the top of any PR/patch summary.
- If a phase prompt contradicts this file, ask which wins.
- Small, composable commits. One logical change per commit.
- Preserve existing patterns when adding new features.
