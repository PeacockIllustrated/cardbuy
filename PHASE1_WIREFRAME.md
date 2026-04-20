# PHASE 1 · Wireframe

> **Read `CLAUDE.md` first.** This document is the complete brief for Phase 1. Do not execute Phase 2+ work. When unsure, ask.

---

## Objective

Build a **naked, monochrome, pre-branding wireframe** of the cardbuy buylist application. The goal is to prove the information architecture, flow, and admin controls **with zero visual noise**. When Lewis looks at this he should immediately understand:

- what a seller does (find cards → pick condition → get offer → submit)
- what Lewis does (review submissions → tune margins → verify cards)

…and he should also immediately understand **this is not finished**. It should feel like a blueprint, not a product.

---

## Aesthetic constraints (non-negotiable)

These exist to prevent premature branding and force focus on structure.

### Allowed
- **Colours:** pure black `#000`, pure white `#fff`, and 3 greys: `#e5e5e5` (light rule), `#a3a3a3` (muted text), `#525252` (secondary text). That's it. Six values total.
- **Fonts:** system monospace for everything (`font-mono`). Tailwind default is fine. Label text may use `font-sans` (system sans) if genuinely needed, but default to mono.
- **Borders:** 1px solid black or 1px solid `#e5e5e5`. Nothing else.
- **Corners:** square, or `rounded-sm` (2px) at most.
- **Spacing:** generous. Whitespace is the only "design" element.
- **Grid:** visible 1px dashed grid overlays are encouraged in empty/content-TBD zones.

### Banned
- ❌ Any colour outside the 6 allowed values
- ❌ Shadows, blurs, glows, gradients
- ❌ Border radius > 2px
- ❌ Icons (use text labels: `[SEARCH]`, `[REMOVE]`, `[+]`)
- ❌ Logos, brand marks, decorative imagery
- ❌ Actual card images (use labelled grey rectangles: `[CARD IMAGE · 245×342]`)
- ❌ Transitions longer than 150ms or any animation beyond hover-state colour inversion
- ❌ Custom illustrations, emoji, stock photos
- ❌ Tailwind's `font-serif` or any imported Google Font

### Required visual motifs
- A **persistent wireframe stamp** in the top-right corner of every page: `WIREFRAME · v0 · NOT FINAL`
- **Annotation labels** on every major region using square brackets: e.g. `[HEADER]`, `[PRIMARY CTA]`, `[SEARCH RESULTS LIST · paginated]`, `[ADMIN-ONLY]`
- **Dimensional labels** on image placeholders: `[CARD IMAGE · 245×342]`
- **TODO markers** visible in the UI where phases 2+ will fill things in: `⟨ TODO P2: real search ⟩`
- A subtle footer on every page: `cardbuy · phase 1 · wireframe · [current page name]`

---

## Tech scope

- Next.js 14 App Router, TypeScript strict.
- Tailwind CSS — grayscale classes only (override the config if helpful to remove temptation).
- **No Supabase.** No `@supabase/*` packages installed in Phase 1.
- **No API calls.** No `fetch()` to external services.
- **No auth.** Admin routes are accessible via a hardcoded `/admin/*` path for now. A dev-only banner at the top says `[ADMIN · no auth yet ⟨ TODO P2 ⟩ ]`.
- **State:** local React state + URL params only. No Zustand yet, add it in P2 when cart persistence matters.
- **Mocks:** all mock data lives in `/lib/mock/`:
  - `mock-cards.ts` — 20 varied cards (different sets, rarities, grades)
  - `mock-submissions.ts` — 5 submissions in various statuses
  - `mock-margin-config.ts` — the full margin config shape populated with placeholder numbers

---

## Pages to wireframe

Build each page as a functional React route. They need to click through, but data doesn't need to persist.

### Seller-facing (`/...`)

**1. `/` — Home / landing**
- Hero block with the core value prop in plain text: `[HEADLINE: Sell your Pokémon cards. Fast offers. Paid via PayPal.]`
- A single prominent search input: `[SEARCH: card name, set, number]`
- Three-step "how it works" strip: `1. Search your cards → 2. Get an instant offer → 3. Post them, get paid`
- Stats row placeholder: `[£ total paid out]  [cards bought]  [avg payout time]` with mock numbers
- Footer: basic links (`About`, `How it works`, `Terms`, `Contact`) — all `href="#"` for now

**2. `/search?q=...` — Search results**
- Top bar with search input retaining query
- Filter sidebar: Set, Rarity, Grading status (raw / graded), Language (EN/JP)
- Results grid: cards as cells showing `[CARD IMAGE]`, name, set, number, and a `[View offer →]` link
- Pagination or "load more"
- Empty-state wireframe for no results

**3. `/card/[id]` — Card detail / offer builder**
- Two-column layout: left is `[CARD IMAGE · 245×342]`, right is the offer builder
- Card metadata: name, set, number, rarity, release year
- **Offer builder** (the important bit):
  - Radio/tabs: `Raw` vs `Graded`
  - If Raw: condition dropdown (`Near Mint`, `Lightly Played`, `Moderately Played`, `Heavily Played`, `Damaged`)
  - If Graded: grading company (`PSA`, `CGC`, `BGS`, `SGC`, `ACE`) + grade (`10`, `9.5`, `9`, `8`, …)
  - Quantity stepper
  - **Offer display:** large number showing computed offer in GBP, with a breakdown underneath: `Market baseline £X · Condition ×Y · Margin ×Z = Offer £N`
  - `[Add to submission]` primary button
- Confidence indicator: `[Based on 23 recent sales · high confidence]` or `[Based on 1 recent sale · low confidence — manual review]`
- `⟨ TODO P3: real pricing engine — currently using mock formula ⟩`

**4. `/submission` — Submission builder (aka "cart")**
- Table of added cards: image thumb, name, condition/grade, qty, offer per unit, line total, remove button
- Running total at the bottom: `Total offer: £X · Cards: N`
- Payout choice: `PayPal cash` vs `Store credit +20%` (as a toggle — purely UI, no logic yet)
- `[Continue to submit →]` CTA
- Empty state: `[Your submission is empty · Go search]`

**5. `/submission/submit` — Checkout / submit**
- Form fields: name, email, phone, postcode, country (UK-default)
- Payout details conditional on payout choice (PayPal email or TBC for store credit)
- Shipping option: `Royal Mail Tracked` (default) vs `Send yourself`
- T&Cs checkbox
- Summary on the right: total offer, cards, payout method
- `[Confirm & get shipping instructions]` primary button
- Annotation: `⟨ TODO P4: actual Royal Mail label generation ⟩`

**6. `/submission/confirmation/[ref]` — Confirmation**
- Big reference number: `CB-2026-000042`
- Shipping address block (static placeholder: `Peacock Solutions, [address TBC]`)
- What happens next, 4 steps
- Status: `Awaiting cards`
- Contact line

### Admin-facing (`/admin/*`)

Every admin page has the red-bordered banner at the top: `[ADMIN · no auth yet ⟨ TODO P2 ⟩ ]` — red being the one exception to the no-colour rule, as an intentional developer warning.

**7. `/admin` — Dashboard home**
- Stats strip: `Submissions this week`, `£ committed`, `Avg offer`, `Cards in queue`
- Two-column layout:
  - Recent submissions list (link to /admin/submissions)
  - Pricing config quicklinks (link to /admin/pricing)
- `⟨ TODO P2: replace mocks with real Supabase queries ⟩`

**8. `/admin/submissions` — Submissions queue**
- Filter tabs: `Awaiting cards` · `Received` · `Under review` · `Offered` · `Paid` · `Rejected`
- Table: ref, seller name, card count, committed total, status, submitted date, action
- Row click → `/admin/submissions/[ref]`

**9. `/admin/submissions/[ref]` — Submission review**
- Left: submission metadata (seller, payout method, shipping status)
- Centre: cards table with a "verified condition" column where Lewis can downgrade a card's condition if the actual card is worse than declared — offer recalculates live
- Right: running adjusted total
- Actions: `[Mark received]`, `[Mark under review]`, `[Offer revised]`, `[Approve & pay]`, `[Reject & return]`

**10. `/admin/pricing` — Pricing config (Lewis's control panel)**
This is the most important admin page. Build it thoroughly.
- **Global controls:**
  - Global buy margin (% slider + number input), e.g. `55%`
  - USD→GBP FX rate (number input, auto-refresh indicator)
  - Minimum buy price (£)
  - Low-confidence sale count threshold (default `3`)
- **Condition multipliers table** — editable inline:
  - NM 100%, LP 85%, MP 65%, HP 45%, DMG 25%
- **Grade multipliers table** — editable inline:
  - PSA 10, 9, 8, 7; CGC 10, 9.5, 9, 8.5; BGS 10, 9.5, 9; SGC 10, 9, 8; ACE 10, 9
- **Per-set overrides:** table — set name, override margin %, active toggle
- **Per-rarity overrides:** table — rarity, override margin %, active toggle
- Save button at the top — but label it `[Save changes — recalculates all open offers]`
- `⟨ TODO P3: hook to offer engine ⟩`

**11. `/admin/cards` — Card catalogue browser**
- Table of cards with latest raw price, confidence (sale count), last synced
- Filter by set, rarity
- Row click → card detail (admin view shows everything the public page hides)
- `⟨ TODO P2: Supabase live data ⟩`

---

## File structure

```
/
├── app/
│   ├── layout.tsx                  # wireframe shell, footer, stamp
│   ├── page.tsx                    # landing
│   ├── search/page.tsx
│   ├── card/[id]/page.tsx
│   ├── submission/
│   │   ├── page.tsx                # cart
│   │   ├── submit/page.tsx         # checkout
│   │   └── confirmation/[ref]/page.tsx
│   └── admin/
│       ├── layout.tsx              # admin shell with dev banner
│       ├── page.tsx                # dashboard
│       ├── submissions/
│       │   ├── page.tsx
│       │   └── [ref]/page.tsx
│       ├── pricing/page.tsx
│       └── cards/page.tsx
├── components/
│   ├── wireframe/
│   │   ├── Annotation.tsx          # <Annotation>HEADER</Annotation>
│   │   ├── ImagePlaceholder.tsx    # <ImagePlaceholder w={245} h={342} />
│   │   ├── WireframeStamp.tsx
│   │   ├── TodoMarker.tsx          # <TodoMarker phase={2}>real search</TodoMarker>
│   │   ├── DevBanner.tsx           # admin-only red banner
│   │   └── GridOverlay.tsx         # optional dashed grid for content-TBD zones
│   ├── ui/                         # buttons, inputs, tables — grayscale only
│   └── cardbuy/                    # domain components (OfferBuilder, SubmissionTable, etc.)
├── lib/
│   └── mock/
│       ├── mock-cards.ts
│       ├── mock-submissions.ts
│       └── mock-margin-config.ts
├── CLAUDE.md
├── PHASE1_WIREFRAME.md
├── PHASE2_DATA_LAYER.md
├── PHASE3_PRICING_ENGINE.md
├── SCHEMA.sql
└── README.md
```

---

## Acceptance criteria

Phase 1 is done when all of the following are true:

- [ ] All 11 pages listed above click-through without errors
- [ ] Every page has the wireframe stamp top-right and the footer
- [ ] Every major region is annotated in square brackets
- [ ] No colour appears on the page except the 6 allowed greyscale values + the one red dev banner on `/admin/*`
- [ ] No icon library is imported
- [ ] No image of a real Pokémon card exists anywhere
- [ ] `/lib/mock/*` contains the three mock files with realistic-shaped data
- [ ] `/components/wireframe/*` helpers are used consistently (not reinvented per page)
- [ ] No Supabase, no external fetches, no auth
- [ ] The admin pricing config page lets you edit the dials (state only, no persistence)
- [ ] The README has the correct "run locally" instructions

---

## Explicitly out of scope

- Real card catalogue (Phase 2)
- Real prices (Phase 2)
- Auth / sign-in (Phase 2)
- Pricing math beyond the mock formula (Phase 3)
- PayPal / Royal Mail / email (Phase 4)
- Branding / visual identity (Phase 5)
- Mobile-first polish — desktop-first wireframe is fine for now, but pages shouldn't *break* on mobile, just be ugly. P5 handles responsive polish.

---

## First action when this phase begins

1. Read `CLAUDE.md` top to bottom.
2. Read this file top to bottom.
3. Read `SCHEMA.sql` to understand the target data shape (for reference — do not build the schema).
4. Confirm the scope back to the operator in 5 bullet points before writing any code.
5. Scaffold the Next.js project, install Tailwind, set up the grayscale-only config.
6. Build the wireframe primitives (`/components/wireframe/*`) first.
7. Build the mock data files second.
8. Build pages in the order listed above.

---

## MID-PHASE AMENDMENT · 2026-04-19 — shopfront added

> The original Phase 1 brief above covered the **buylist** flow only. After the buylist wireframe was built and verified clean, the operator confirmed Lewis runs an in-person buy-and-sell business — so the digital build needs both sides. This amendment adds the **shopfront** wireframe to Phase 1 scope. All aesthetic constraints from the top of this file still apply — these new pages are also naked grayscale wireframes.

### Additional pages — seller-facing (`/shop/*`)

**12. `/shop` — storefront browse**
- Filter sidebar: Set, Rarity, Condition (raw NM/LP/MP/HP/DMG), Grading (graded only / raw only), price range, in-stock toggle
- Grid of listings: `[CARD IMAGE]`, name, set, condition/grade, price, `[Add to basket]`
- Featured rail at the top: `[FEATURED · 4 slots]` showing the listings Lewis has flagged as featured
- Sort: featured → newest → price asc → price desc

**13. `/shop/[id]` — listing detail**
- Two-column: `[CARD IMAGE · 245×342]` | listing details (price, condition/grade, qty in stock, SKU, condition notes Lewis wrote)
- `[Add to basket]` + quantity stepper (capped at qty-in-stock)
- "Other listings of this card" strip showing other conditions/grades currently in stock

**14. `/shop/cart` — basket**
- Table: image, name, condition/grade, qty, unit price, line total, remove
- Total + `[Continue to checkout →]`
- Empty state

**15. `/shop/checkout` — checkout**
- Buyer details (name, email, phone, shipping address — UK default), shipping method (Royal Mail Tracked / Special Delivery), card payment placeholder, T&Cs
- Summary panel
- `[Pay now]` (no real payment in P1 — `⟨ TODO P4: Stripe ⟩`)

**16. `/shop/order/[ref]` — order confirmation**
- Big order ref (format: `CB-ORD-YYYY-NNNNNN`)
- "What happens next" — 4 steps (paid → packed → shipped with tracking → delivered)
- Order summary
- Contact line

### Additional pages — admin-facing (`/admin/*`)

**17. `/admin/inventory` — listings manager** *(critical sell-side admin page)*
- Filter tabs: `Active · Hidden · Sold out · Featured`
- Table per listing: image thumb, card name, SKU, condition/grade, qty in stock, list price (£) — inline editable, cost basis (what we paid), margin %, **featured toggle**, status, action
- "Add new listing" button (no implementation in P1 — wireframe only)
- Featured slot indicator at the top: `[Featured: 3 / 4 used]`

**18. `/admin/orders` — orders queue** *(sell-side mirror of `/admin/submissions`)*
- Filter tabs: `Pending payment · Paid · Packing · Shipped · Delivered · Refunded · Cancelled`
- Table: order ref, buyer, item count, total, status, placed date, action
- Row click → `/admin/orders/[ref]` *(detail page is OUT of scope for this amendment — backlog for P2 expansion)*

### Improved existing pages

**1. `/` — home** *(rebuild)*
- Two equally-prominent CTAs above the fold: `[Sell your cards →]` and `[Browse the shop →]`
- Featured listings rail (top 4 from `/admin/inventory` flagged featured)
- Existing how-it-works strip + stats row remain

**7. `/admin` — dashboard** *(rebuild)*
- Two-column stats: **Buy side** (submissions this week, £ committed, cards in queue) and **Sell side** (orders this week, £ revenue, listings in stock, low-stock alerts)
- Featured slot manager preview (which listings are currently featured + a link to `/admin/inventory?status=featured`)
- Recent activity feed combining submissions + orders, time-sorted
- Quicklinks: pricing config, inventory, orders, submissions

### New mock files
- `/lib/mock/mock-listings.ts` — ~12 listings across the existing `MOCK_CARDS`, mix of raw + graded, ~3 flagged featured, varied stock levels
- `/lib/mock/mock-orders.ts` — 5 orders in varied statuses

### Schema additions (reference, applied in P2)
- `cb_listings` — id, card_id, sku, variant (raw|graded), condition, grading_company, grade, price_gbp, cost_basis_gbp, qty_in_stock, qty_reserved, status (active|hidden|sold_out), is_featured, featured_priority, condition_notes, created_at, updated_at
- `cb_orders` — id, reference (`CB-ORD-…`), buyer_id (or guest fields), status, total_gbp, payment_method, shipping_method, shipping_address (jsonb), placed_at, paid_at, shipped_at, tracking_number
- `cb_order_items` — id, order_id, listing_id, qty, unit_price_gbp_snapshot, line_total_gbp

### Out of scope for this amendment (deferred to P2 unless promoted)
- `/admin/orders/[ref]` detail page (queue list only in P1)
- "Add new listing" form
- Real Stripe checkout
- Tracking integration
- Reservation locking when items are in someone's cart
- Inventory adjustments / stock-take UI
