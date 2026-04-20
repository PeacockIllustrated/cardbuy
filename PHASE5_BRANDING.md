# PHASE 5 · Branding

> **Read `CLAUDE.md` and `PHASE5_BRANDING_REFERENCES.md` first.** This is the brief for Phase 5. Phases 2–4 are queued behind this; the operator promoted branding early so Lewis can react to the look before data wiring locks in component shapes.

---

## Objective

Apply a **pop-art brand system** to the Phase 1 wireframe (incl. shopfront amendment) without changing routes, IA, or business logic. When Lewis loads the homepage he should immediately feel that this is *his* shop — saturated, confident, unmistakably TCG-adjacent — while the wireframe stamp + TODO markers still make clear the engine isn't wired up yet.

---

## Design tokens (non-negotiable until reviewed)

### Palette
| Token | Hex | Use |
|---|---|---|
| `--color-ink` | `#0a0a0a` | Outlines, headings, primary text. Used for every border that defines a "card" or CTA. |
| `--color-paper` | `#fff8e7` | Cream page background. Replaces pure white — softer with the saturated accents. |
| `--color-paper-strong` | `#ffffff` | Pure white when needed for tight contrast against an accent block. |
| `--color-pink` | `#ff4eb8` | Primary accent — featured tiles, primary CTAs on customer-facing pages. |
| `--color-teal` | `#27d3c4` | Secondary accent — section backgrounds, "buy" surfaces, badges. |
| `--color-yellow` | `#ffe600` | Tertiary accent — "sell" surfaces, save banners, highlight chips. |
| `--color-rule` | `#e8dfc7` | Cream-toned hairline rule (instead of grey on cream). |
| `--color-muted` | `#7a7466` | Secondary text on cream. |
| `--color-warn` | `#c00000` | Reserved for the admin DevBanner only. |

**Rule of three:** any single page uses at most two accent colours together (plus paper + ink). Three accents on one screen is loud; reserve that for the homepage hero.

### Type
Two-font system, no third "marquee" face — palette does the personality work.

- **Display:** `Archivo Black` (Google Fonts, single weight 900) — heavy condensed grotesque. All-caps for nav, CTAs, big hero phrases, and price displays. Loaded via `next/font/google`, exposed as `--font-display`.
- **Body:** `Inter` (Google Fonts, weights `400`/`500`/`700`) — workhorse sans for paragraphs, tables, forms, secondary copy. Loaded via `next/font/google`, exposed as `--font-sans`.
- **Numerals:** Tabular numerals on every price, stock count, and stat (`font-variant-numeric: tabular-nums`). Already a strong feature of Inter; explicit on Archivo Black via CSS.

**Fonts considered and rejected:** Bowlby One (too rounded/cartoony), Bungee (too signage-novelty), Anton (too narrow), Space Grotesk (numerals weaker than Inter for table density), DM Sans (close runner-up to Inter).

### Geometry
- **Outlines:** 3px solid `--color-ink` on cards, 4px on primary CTAs. Never less than 2px.
- **Corners:** `rounded-md` (6px) by default, `rounded-lg` (10px) on hero blocks. No fully-rounded pills outside small badges.
- **Shadows:** Single offset shadow `4px 4px 0 0 var(--color-ink)` on featured tiles + primary CTAs. No blurred / soft shadows. The shadow lifts on hover (`6px 6px`) and presses on click (`0 0`).
- **Spacing:** Generous. `gap-6` minimum between major sections; `p-6` minimum on cards.

### Iconography
- No line-icon library imports. If a glyph is needed, render it as a chunky filled SVG inside a coloured square tile (`w-10 h-10`, `bg-{accent}`, 3px ink border).
- Text-label CTAs (`[ADD TO BASKET]`, `[VIEW CART]`) replaced with proper title-case labels (`Add to basket`, `View cart`) — but keep the chunky display font.

---

## Surface system

| Surface | Treatment |
|---|---|
| **Page background** | `--color-paper` cream with no texture. |
| **Section block** | White or accent-coloured rectangle, 3px ink outline, 4px ink offset shadow. Square corners or `rounded-md`. |
| **Card / listing tile** | White rectangle, 3px ink outline, accent-coloured top stripe (the card image well sits inside an accent-coloured panel). Shadow lifts on hover. |
| **Primary CTA** | Full-width on mobile, intrinsic on desktop. `bg-pink` text-ink, 3px ink outline, 4px offset shadow. Hover: shifts to `6px` shadow. Active: shadow → 0. |
| **Secondary CTA** | Same geometry on `bg-paper-strong`. |
| **Tertiary / nav link** | Underline-on-hover only, no fill. |
| **Form input** | White, 3px ink outline, no inner shadow. Focus ring = +1px ink + offset shadow. |
| **Table row** | Cream rows, ink-rule between, no zebra. |
| **Admin pages** | Quieter: same fonts, same colours, but accents reserved for status badges / featured indicators. Density priority — admin is a tool. |

---

## Component checklist

These are the existing files the brand system applies to. Restyle, do not rewrite logic:

**Wireframe primitives** (still in use because pre-launch):
- `WireframeStamp` — chunky pink badge, top-right, with offset shadow
- `TodoMarker` — yellow tape-style chip
- `Annotation` — *remove from customer-facing pages*; keep on admin where the IA labels are still useful for Lewis
- `ImagePlaceholder` — coloured "card well" with chunky outline; rotate accent colour by `card_id` hash so the grid feels alive
- `DevBanner` — keep red, restyle to match brand geometry (3px outline, offset shadow)

**UI primitives:**
- `Button` (Form.tsx) — pop-art block with offset shadow
- `Input`, `Select`, `Textarea` — white well + 3px ink outline + tabular numerals on number inputs
- `Field` — bigger label type, more breathing room
- `Table` family — keep dense; add ink rule between rows

**Cardbuy components:**
- `SellerNav` — chunky display wordmark + nav links in display caps
- `ListingCard` — accent-coloured image well, chunky outline, offset shadow, price in display sans
- `OfferBuilder` — convert pill tabs to chunky toggle, offer number in display sans
- `SubmissionReview` — admin-quiet brand
- `admin/layout.tsx` — chunky brand wordmark + grouped nav (already structured)

---

## Page polish priorities

Tackle in this order — get the homepage and shop right first, then sweep the rest:

1. **Homepage `/`** — dual hero gets the full pop-art treatment. Left block = pink (sell), right block = teal (buy). Featured rail = yellow background strip, tiles inside with white wells.
2. **`/shop`** — featured rail at top (yellow strip), filter sidebar quieter (cream + ink), listings grid with rotating accent wells.
3. **`/shop/[id]`** — accent-coloured image well behind the placeholder, chunky price display, full-width primary CTA.
4. **`/`** *(if it needs a second pass)* + **`/card/[id]`** + **`/submission/*`** + **`/search`** — apply the system, no bespoke per-page tweaks.
5. **`/admin/*`** — quieter brand pass. Headings get display sans, status badges pick up accents, but otherwise stay dense.

---

## Out of scope for Phase 5
- Logo design (placeholder wordmark in display sans is fine — final logo is its own engagement)
- Real card photography (still copyright-bound until Phase 2's pokemontcg.io integration)
- Mobile-first redesign (improve responsiveness opportunistically; full responsive pass = Phase 5.5 if needed)
- Animation beyond hover-shadow lifts (no carousels, no scroll-triggered reveals)
- Email / receipt templates (deferred with PHASE4)
- Marketing pages (about / how-it-works / FAQ) — IA reservation only, copy in Phase 5.5

---

## Acceptance criteria

Phase 5 is done when all of the following are true:
- [ ] Every page renders the cream page background (`--color-paper`) and the brand fonts (Archivo Black + Space Grotesk)
- [ ] All primary CTAs use the chunky offset-shadow pop-art block style
- [ ] All listing/card tiles use accent-coloured image wells + ink outlines
- [ ] No grayscale-only screen remains on customer-facing pages
- [ ] Wireframe stamp, TodoMarkers, and admin DevBanner restyled to match the brand geometry
- [ ] Lighthouse / quick a11y check: text on every accent-on-accent pairing meets WCAG AA at body size
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm build` all clean
- [ ] Browser smoke: `/` and `/shop` look like the same product as the inspiration image
