# CONCEPT · Binder (My Collection)

> **Status: concept only.** Do not scaffold code, schemas, or routes from this document. Read, reason, raise questions, and propose a phased build plan. The operator will promote this to a formal phase brief once the shape is agreed.

---

## What it is

A logged-in user's personal digital binder. They catalogue the physical Pokémon cards they own — at minimum "I have this card," at maximum quantity, condition, variant, grade, acquisition notes. It lives at `/binder` and belongs to them.

For the user, it's a collector's tool. Set-completion progress, live GBP valuation of the collection, nice binder-style visual layout, shareable if they want.

For cardbuy, it's the latent supply and demand layer that sits underneath the live shop and buylist. Every card a user owns is a signal of potential supply. Every card on their wishlist is a signal of potential demand. Lewis uses this data to do targeted matchmaking rather than broadcasting to everyone.

---

## Why it exists

Three reasons, in priority order.

1. **Lead gen.** A free, useful reason for people to sign up and stay signed in. The buylist converts transactional users. The binder converts collectors, who are a different psychographic and much stickier.
2. **Latent inventory intelligence.** Lewis knows who holds what across the UK, how much, and in what condition. That turns his sourcing from reactive (hope someone lists the card he needs) to proactive (offer an enhanced buyback to the three users who already own it).
3. **Demand capture.** Wishlists convert shop inventory faster. The moment a card arrives in stock, users who've wanted it get notified. No need to hope they see it in a feed.

---

## Core user experience

### Onboarding
- Zero-friction add. From any card detail page on the existing site, a logged-in user can mark "I own this" with one tap. No modal, no form. Quantity defaults to 1.
- Progressive depth. If they want to add condition, variant, grade, acquisition date, notes — there's a drawer that expands. Default stays simple.

### Binder view
- `/binder` — their collection, grouped by set by default. Filter, search, sort.
- Binder page layout — nine-card grid that mimics a physical binder page. Optional alternate views: list, grid, spreadsheet-dense.
- Per-set progress. "82 / 102 Base Set." Completion percentage. Missing-card overlay shows silhouettes of what they're missing.
- Live portfolio value in GBP, calculated from the same pricing source the shop/buylist use. Updates daily.

### Wishlist
- Same mechanic, inverse. "I want this card" toggle on any card detail page.
- Separate tab in the binder view. Optional target price — "I'd buy this for £X or less."

### Sharing (opt-in)
- Each user gets a public binder URL, `/u/[handle]`, switched off by default.
- If switched on, shows their collection but respects privacy settings (hide value, hide wishlist, etc.).

---

## The matchmaking layer

This is where the data earns its keep — but it's a separate phase from the binder itself. The binder has to exist and have data in it before matchmaking can do anything. Flagging it here so the early phases don't accidentally make matchmaking harder later.

Three matchmaking flows, all driven from the admin panel:

- **"Someone wants what you have."** Lewis has a buyer for a specific card. System surfaces users holding it and offers them an enhanced buyback.
- **"We've got what you want."** Card arrives in cardbuy's shop inventory. Users with it on their wishlist get one notification.
- **"Your card is worth more than it was."** Market price crosses a user-defined threshold. Optional nudge with a buylist offer.

Notification quality matters enormously. Better to send one well-targeted email a fortnight than five noisy ones a week. Volume is a config Lewis controls from the admin panel, per-user cap included.

---

## Data shape (sketch, not authoritative)

Rough sense of what the schema extension looks like, for sanity-checking only:

- `cb_users` already exists. Binder data attaches to users.
- `cb_binder_entries` — user_id, card_id, quantity, variant, condition, grade, grading_company, acquisition_date, notes, added_at.
- `cb_wishlist_entries` — user_id, card_id, target_price, variant, condition_preference, added_at.
- `cb_matchmaking_events` — records of every notification sent, for audit, dedup, and analytics.
- User-facing notification preferences live on `cb_users` as a jsonb settings column.

Exact shape is for the phase brief, not this document.

---

## The legal / privacy layer (mandatory, not optional)

Because the binder collects genuinely personal data — more so than the buylist, which is transactional — the consent UX is part of the feature, not an afterthought. The scaffolding must include:

- **Granular opt-in at signup.** Separate consents for: service emails (transactional), buylist marketing (targeted offers), shop marketing (wishlist alerts), aggregate data use (anonymous portfolio data informing pricing intelligence). Default all marketing consents to OFF.
- **Settings page** where the user can toggle each of those independently at any time.
- **Right-to-erasure.** Deleting a binder entry removes it. Deleting an account removes everything, not just soft-deletes. Audit this properly.
- **Privacy policy copy** that specifically covers collection data, not just generic site data. Operator will write this; build must link to it from the binder onboarding flow.
- **No dark patterns around consent.** The "you'd get more value if you enabled marketing" nudge can exist, but not as a blocker to using the binder.

Under UK GDPR + PECR, marketing consent is separate from terms acceptance. The build must reflect that at the data layer — a `consent_marketing_buylist` boolean, not an implicit "they signed up so they're fair game."

---

## What's deliberately out of scope for the initial build

- AI photo-to-card recognition for adding to binder. Huge UX win, separate phase, lots of edges.
- Price history graphs per card. Read-only display is enough for v1; analytics come later.
- Insurance-grade valuation exports / PDF statements. A premium-tier idea, not relevant yet.
- Collection import from CSV / other apps (Dex, Collectr, Pokellector). Nice-to-have, not launch-critical.
- Trading between users. This turns cardbuy into a marketplace, which is a fundamentally different product. Out.
- Public leaderboards of top collectors. Fun idea, social-layer work, not now.

---

## Suggested build order

Not a phase brief — just a suggestion for how to think about sequencing. The operator will decide the actual order.

1. **Minimum viable binder.** Owned/not-owned toggle on card detail. Quantity defaults to 1. `/binder` shows a flat list of owned cards. No conditions, no variants, no wishlist, no sharing. Data flywheel starts.
2. **Proper binder.** Conditions, variants, grades, progress bars, portfolio value, binder-page visual layout.
3. **Wishlist.** Parallel mechanic to owned.
4. **Public profiles.** Opt-in sharing.
5. **Matchmaking layer.** Admin-driven campaigns that query the binder/wishlist data.

Each of these is a phase brief when it's ready to build. This document is none of them.

---

## Questions to resolve before writing any phase brief

Claude Code: your first job with this concept is to read it, and then raise the questions below (or your own better ones) before we commit to anything.

1. **Where does the binder sit relative to the existing shop/sell flows?** Tab in the top nav? Secondary surface only exposed after signup? Integrated into card detail?
2. **How does the binder relate to the submission flow?** Can a user add a binder card to a submission in one tap? If yes, the binder becomes the fastest path into the sell flow and that changes the UX.
3. **How granular should the owned-card record be?** A user can own three NM raw Charizards AND one PSA 9 AND one LP reverse holo. Is that one row per condition, or one row with a nested variants array? This decision ripples through everything.
4. **What's the pricing source for the portfolio value?** Same data that powers the shop? Buylist value (what Lewis would pay) or market value (what it's worth)? Both, with a toggle? This is a conceptual decision, not a technical one.
5. **Should wishlist be visible to Lewis as aggregate data before matchmaking ships?** A "30 users want this card" admin view is trivially valuable even without automated notifications. Might be worth including in phase 1 for that reason alone.
6. **What happens to binder data if a user deletes their account?** Hard delete is simplest and GDPR-correct. But the aggregated, anonymised signal ("X copies of this card are held across our userbase") has business value. Are we retaining that after deletion? If yes, make the anonymisation explicit and consent-gated.
7. **Authentication timing.** The existing site doesn't have real auth yet (Supabase Auth was deferred). The binder inherently requires auth. Does the binder phase pull auth forward, or do we stand up auth as a blocking prerequisite?

Raise these (plus anything else you spot) before we turn this into a phase brief.
