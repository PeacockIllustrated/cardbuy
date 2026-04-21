# PHASE 6 · BINDER PERSISTENCE (SLICE A)

> Slice A of the four-slice binder roll-out sketched in `CONCEPT_BINDER.md`. Makes
> `/binder` work against real Supabase-backed storage and introduces a one-tap
> "I own this / I want this" affordance on the card detail page. Slices B–D
> (shop loop, consent/matchmaking, camera scan) are deferred — see bottom.

---

## 00 · Status

Ready to promote. Depends on Phase 1 (wireframe) and Phase 5 (branding), both
signed off. Supabase infra is already wired (server/browser/admin clients,
migrations folder, RLS conventions, `lewis_users` with role column) — no infra
prep work is in scope.

The mocked surface at `app/(seller)/binder/page.tsx` + `lib/mock/mock-binder.ts`
was shipped in the Phase-5 branding pass. This phase replaces the mock reads
with real data and wires the existing action buttons.

---

## 01 · Goal

Signed-in users can build and maintain a Pokédex-ordered Gen-1 binder that
persists. Every sticker action button already rendered by `BinderPanel` has a
backing server action. Every card detail page offers a one-tap way into the
binder or onto the wishlist.

---

## 02 · Non-goals (deferred)

Explicitly out of scope for Slice A. Do not build these here.

- Shop-order → binder auto-add (Slice B)
- `/admin/demand` aggregate wishlist view (Slice B)
- Binder → submission pre-fill beyond navigation (Slice B)
- Consent columns on `lewis_users`; marketing opt-ins; GDPR settings page (Slice C)
- Wishlist email notifications; matchmaking event log (Slice C)
- Framed-camera graded-card scan (Slice D — see `project_graded_card_onboarding.md`)
- Market-driven portfolio valuation (Phase 3 pricing engine)
- Gen 2+ binders
- Public sharing, `/u/[handle]`, privacy toggles
- CSV import, price history graphs, trading between users

---

## 03 · Decision log (already locked — don't re-litigate)

- **DB prefix:** `lewis_` (per `feedback_db_prefix.md`). Never `cb_`.
- **Granularity:** one row per
  `(user_id, card_id, variant, condition, grading_company, grade)` tuple, plus
  a `quantity` column. Does not explode into one-row-per-physical-card.
- **Wishlist key:** `card_id` (specific print). The binder missing-slot
  wishlist toggle targets the dex registry's canonical print
  (`GEN1_DEX[n].sampleCardId`). User can add additional prints from card detail.
- **Account deletion:** hard delete. No aggregated retention.
- **Dex layout:** entirely a client/fixture concern. The schema is card-keyed,
  not dex-keyed — the UI derives dex number from the fixture at read time.

---

## 04 · Operator-confirm-before-coding checkpoints

Please answer before I cut the migration. None of these are large, but each is
load-bearing for the schema or server actions.

1. **Grail rule:** one Grail per user total (mock behaviour), or one per set?
   My default is **one per user total** — simpler to enforce, matches the
   "prize card" emotional register.
2. **`addBinderEntry` on duplicate tuple:** increment `quantity`, or error
   back to the caller so they can decide? My default is **increment**.
3. **"Sell this card" destination:** (a) navigate to `/submission/submit` with
   the card pre-selected in a draft, or (b) just navigate with a query param
   the submission flow reads? My default is **(a) pre-fill the draft** — the
   binder→submission loop is the whole point; making it one click matters.
4. **Quantity in the UI for graded cards:** should the quantity pill allow
   `>1` for graded rows (e.g. "×2 PSA 9")? My default is **yes** — collectors
   do own duplicates of graded cards. If the answer is no, add a check
   constraint `quantity = 1 when variant = 'graded'`.

---

## 05 · Schema · migration `0006_binder.sql`

Follows the pattern in `0001_auth_submissions.sql`. Uses `gen_random_uuid()`,
`set_updated_at()` trigger, `is_admin()` helper from migration 0004.

### `lewis_binder_entries`

| col                | type          | notes                                                              |
|--------------------|---------------|--------------------------------------------------------------------|
| `id`               | uuid          | pk, default `gen_random_uuid()`                                    |
| `user_id`          | uuid          | not null, fk → `auth.users(id) on delete cascade`                  |
| `card_id`          | text          | not null. pokemontcg.io id, e.g. `base1-4`                         |
| `variant`          | text          | not null. check `in ('raw', 'graded')`                             |
| `condition`        | text          | nullable. check `in ('NM','LP','MP','HP','DMG')`                   |
| `grading_company`  | text          | nullable. check `in ('PSA','CGC','BGS','SGC','ACE')`               |
| `grade`            | text          | nullable. check `in ('10','9.5','9','8.5','8','7')`                |
| `quantity`         | integer       | not null, default 1, check `>= 1`                                  |
| `is_grail`         | boolean       | not null, default false                                            |
| `note`             | text          | nullable                                                           |
| `acquired_at`      | timestamptz   | not null, default `now()`                                          |
| `created_at`       | timestamptz   | not null, default `now()`                                          |
| `updated_at`       | timestamptz   | not null, default `now()`, trigger-maintained                      |

**Constraints:**
- Unique `(user_id, card_id, variant, condition, grading_company, grade)` —
  `null` values in nullable columns participate in the uniqueness as distinct
  values (Postgres default).
- Row check: if `variant = 'raw'` then `condition is not null` and grading
  columns are null; if `variant = 'graded'` then `grading_company`, `grade`
  are not null and `condition` is null.
- Partial unique index on `(user_id) where is_grail` — enforces one grail
  per user in a single transaction (assuming checkpoint answer = option 1).

**Indexes:**
- `(user_id)` — primary query.
- `(card_id)` — admin "who owns this card" (for Slice B's `/admin/demand`).

### `lewis_wishlist_entries`

| col                | type          | notes                                                              |
|--------------------|---------------|--------------------------------------------------------------------|
| `id`               | uuid          | pk                                                                 |
| `user_id`          | uuid          | not null, fk → `auth.users(id) on delete cascade`                  |
| `card_id`          | text          | not null                                                           |
| `target_price_gbp` | numeric(10,2) | nullable                                                           |
| `notified_at`      | timestamptz   | nullable. Populated by Slice C's matchmaking worker                |
| `created_at`       | timestamptz   | not null, default `now()`                                          |
| `updated_at`       | timestamptz   | not null, default `now()`                                          |

Unique `(user_id, card_id)`. Index on `(user_id)` and `(card_id)`.

### RLS

Both tables: enable RLS. Four policies each (select/insert/update/delete):
- User policy: `user_id = auth.uid()`.
- Admin select-only override using the existing `is_admin()` helper.

---

## 06 · Server actions · `app/_actions/binder.ts`

`'use server'` at top. Each action calls `supabase.auth.getUser()` and
redirects to `/login` if null (mirrors `submission.ts` pattern). No input
validation library — manual type narrowing. All actions call
`revalidatePath('/binder')` on success (and `/card/[id]` where the originating
page matters).

Signatures (pseudocode):

```ts
type AddBinderEntryInput = {
  card_id: string;
  variant: 'raw' | 'graded';
  condition?: Condition;
  grading_company?: GradingCompany;
  grade?: Grade;
  quantity?: number;  // default 1
  note?: string;
};

addBinderEntry(input: AddBinderEntryInput): Promise<{ entryId: string }>;
// On existing tuple, increments quantity (per checkpoint #2 default).

removeBinderEntry(entryId: string): Promise<void>;
// Ownership-checked. Hard delete.

updateBinderEntry(entryId: string, patch: {
  quantity?: number;
  note?: string | null;
  condition?: Condition;       // raw only
  grading_company?: GradingCompany; // graded only
  grade?: Grade;                // graded only
}): Promise<void>;

setGrail(entryId: string, makeGrail: boolean): Promise<void>;
// If makeGrail=true, first unsets any existing grail for this user
// in a single transaction.

toggleWishlist(cardId: string): Promise<{ onWishlist: boolean }>;
// Insert if absent, delete if present. Returns new state.

setWishlistTarget(cardId: string, targetGbp: number | null): Promise<void>;
// Upserts; creates a wishlist entry if one doesn't already exist.
```

Error handling: throw on Supabase failure so Next.js shows the error boundary.
No swallow-and-log.

---

## 07 · UI changes

### `app/(seller)/binder/page.tsx`

- Replace `MOCK_BINDER_ENTRIES` / `MOCK_BINDER_PORTFOLIO` / `MOCK_BINDER_USER`
  imports.
- Add auth gate: `getUser()` → `redirect('/login?next=/binder')` if null.
- Pull `full_name` (fallback `email` local-part) from `lewis_users` for the
  header's "Alice's collection" label.
- Replace entry lookup with
  `from('lewis_binder_entries').select('*').eq('user_id', me.id)`. Wishlist
  ditto.
- Portfolio total for Slice A: keep the existing heuristic (sum of lowest
  active shop listing per owned card). Real pricing engine is Phase 3. Add a
  comment pointing that out.
- Delta (`+£42 since Tuesday`) stays hardcoded for Slice A — calculating a
  real delta requires price-history, which is Phase 3.

### `components/cardbuy/binder/BinderPanel.tsx`

The sticker action row already exists in `OwnedDetails` and `MissingDetails`.
Wire each button to its server action. Keep the buttons client-side and call
server actions through the `'use server'` import contract.

- `+ Add copy` — opens a small drawer inside the info pane with variant +
  condition/grade pickers; submits `addBinderEntry` with the slot's
  canonical `card_id`. Optimistic UI: the "Your copies" list grows
  immediately.
- `◉ Scan graded` — **stays a no-op in Slice A.** Leave a `title` hint
  explaining it's the camera flow (Slice D). Do not remove the button.
- `★ Mark/Unmark Grail` — calls `setGrail(entry.id, true|false)`. Label
  already toggles based on `hasGrail`.
- `→ Sell this card` — navigates to
  `/submission/submit?prefill_card=<card_id>&prefill_entry=<entry_id>`.
  (Pending checkpoint #3 confirmation.)
- Missing-slot `★ Add to wishlist` — wires to `toggleWishlist`. Optimistic
  toggle, reverts on server error.
- Missing-slot target-price input — debounced (500ms) `setWishlistTarget`
  on change. Empty input clears the target (passes `null`).

The `Edit` link on each "Your copies" row: opens a small inline editor (same
drawer component as Add Copy, pre-filled). Submits `updateBinderEntry`.

### `app/(seller)/card/[id]/page.tsx`

Add a small client component `<BinderChipRow />` placed between the existing
chipset (around line 119–141 of the current page) and the `OfferBuilder`.
Two chips:

1. **`+ Add to binder` / `✓ In your binder · ×N`** — click opens a small
   popover with variant/condition/grade selectors. Submits `addBinderEntry`.
   If the chip shows `✓ In your binder`, clicking it instead opens a popover
   listing current copies with per-copy `Edit`/`Remove` links.
2. **`★ Add to wishlist` / `★ On wishlist`** — calls `toggleWishlist`.

Signed-out visitors see both chips but clicking either routes to
`/login?next=/card/[id]`. No fake "preview" behaviour.

---

## 08 · Acceptance criteria

- [ ] Signed-out user hitting `/binder` is redirected to
      `/login?next=/binder`.
- [ ] Signed-in user with zero binder entries sees the Pokédex grid with
      all 151 slots in silhouette state; the info pane shows the empty-state
      overview.
- [ ] Adding a card from card detail and returning to `/binder` shows that
      card's dex slot populated on next load (no stale data).
- [ ] Removing the last entry for a dex slot restores the silhouette.
- [ ] Enabling Grail on an entry disables any prior grail for that user in a
      single transaction. Two grails can never coexist.
- [ ] Wishlist toggle persists across refresh.
- [ ] Target price persists and accepts `null` (empty input).
- [ ] A second user cannot see or modify the first user's binder (RLS
      verified by probing from a logged-in second account).
- [ ] `pnpm typecheck` clean.
- [ ] `pnpm lint` clean for new files (existing unrelated lint noise stays
      as-is).
- [ ] `pnpm build` succeeds.

---

## 09 · Sequencing

1. Answer checkpoints (04). ~10 min.
2. Write migration `0006_binder.sql`. Apply via Supabase Studio or CLI.
   Verify RLS by probing with two Supabase client sessions.
3. Write `app/_actions/binder.ts` against the schema. Unit-untested for
   Slice A — we rely on the acceptance checklist.
4. Swap `/binder` mock reads for real queries. Keep the existing UI; only
   the data source changes.
5. Wire `BinderPanel` action buttons to the new server actions.
6. Build `BinderChipRow` on the card detail page.
7. Run acceptance checklist against a real user. Sign off.

Estimate: 1–2 focused days if checkpoints come back the same working session.

---

## 10 · What carries into Slice B

- `lewis_binder_entries` + RLS — reused by shop→binder auto-add.
- `lewis_wishlist_entries` — reused by `/admin/demand` aggregate view and
  Slice C notifications.
- `addBinderEntry` server action — reused by the shop-order-delivered hook.
