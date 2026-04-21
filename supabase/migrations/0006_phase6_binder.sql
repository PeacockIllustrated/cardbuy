-- ================================================================
-- Phase 6 · Binder persistence (Slice A)
-- ================================================================
-- Two tables backing the `/binder` feature: owned cards
-- (`lewis_binder_entries`) and a wishlist (`lewis_wishlist_entries`).
-- Brief: PHASE6_BINDER.md. Concept: CONCEPT_BINDER.md.
--
-- Non-destructive, idempotent. Same conventions as 0001:
--   • No `drop`, `truncate`, `delete`, `alter column`.
--   • `create table if not exists` + `do $$` existence guards for
--     every trigger/policy.
--   • Re-running this file is a no-op.
--
-- Decisions locked in the brief — do not re-litigate here:
--   • Granularity: one row per
--     (user_id, card_id, variant, condition, grading_company, grade)
--     tuple + quantity. Does not explode per physical card.
--   • NULLs in the grouping key are considered equal for uniqueness
--     (NULLS NOT DISTINCT, Postgres 15+). Without this, two
--     `raw/NM/NULL/NULL` rows would both land because Postgres's
--     default treats nulls as distinct.
--   • Grail rule: one grail PER USER TOTAL. Enforced by a partial
--     unique index on (user_id) where is_grail = true.
--   • Row-shape check: raw rows must have condition set and both
--     grading columns null; graded rows must have both grading
--     columns set and condition null.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Binder entries — a user's owned-card rows.
-- ----------------------------------------------------------------
create table if not exists lewis_binder_entries (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  card_id             text not null,

  variant             text not null check (variant in ('raw', 'graded')),
  condition           text check (condition in ('NM', 'LP', 'MP', 'HP', 'DMG')),
  grading_company     text check (grading_company in ('PSA', 'CGC', 'BGS', 'SGC', 'ACE')),
  grade               text check (grade in ('10', '9.5', '9', '8.5', '8', '7')),

  quantity            int not null default 1 check (quantity >= 1),
  is_grail            boolean not null default false,
  note                text,

  acquired_at         timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- Shape invariant: raw → condition only; graded → grading company + grade only.
  constraint lewis_binder_entries_shape_check check (
    (variant = 'raw'    and condition is not null and grading_company is null and grade is null)
    or
    (variant = 'graded' and condition is null and grading_company is not null and grade is not null)
  ),

  -- Dedup key — the add-entry action upserts against this. NULLS NOT
  -- DISTINCT is required so (raw, 'NM', NULL, NULL) tuples collapse
  -- across inserts instead of multiplying.
  constraint lewis_binder_entries_tuple_unique unique nulls not distinct
    (user_id, card_id, variant, condition, grading_company, grade)
);

-- Primary access pattern: "give me this user's binder".
create index if not exists idx_lewis_binder_entries_user
  on lewis_binder_entries(user_id);

-- Secondary: admin aggregate views (Slice B's /admin/demand).
create index if not exists idx_lewis_binder_entries_card
  on lewis_binder_entries(card_id);

-- One grail per user total. Partial unique index — at most one row
-- per user can have is_grail = true. Enforced atomically; swapping
-- grails is a two-step transaction in the `setGrail` server action.
create unique index if not exists idx_lewis_binder_entries_one_grail_per_user
  on lewis_binder_entries(user_id) where is_grail = true;

-- Bump updated_at on every row change — reuses the helper from 0001.
do $$
begin
  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where t.tgname = 'lewis_binder_entries_touch'
      and n.nspname = 'public'
      and c.relname = 'lewis_binder_entries'
  ) then
    create trigger lewis_binder_entries_touch
      before update on lewis_binder_entries
      for each row execute function lewis_touch_updated_at();
  end if;
end $$;

-- ----------------------------------------------------------------
-- 2. Wishlist entries — cards a user wants to acquire.
-- ----------------------------------------------------------------
-- `notified_at` is reserved for Slice C's matchmaking worker so it
-- can dedup alerts ("we've got what you want"). Added now to avoid a
-- follow-up ALTER TABLE when Slice C ships.
create table if not exists lewis_wishlist_entries (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  card_id             text not null,

  target_price_gbp    numeric(10, 2) check (target_price_gbp is null or target_price_gbp >= 0),
  notified_at         timestamptz,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint lewis_wishlist_entries_unique unique (user_id, card_id)
);

create index if not exists idx_lewis_wishlist_entries_user
  on lewis_wishlist_entries(user_id);
create index if not exists idx_lewis_wishlist_entries_card
  on lewis_wishlist_entries(card_id);

do $$
begin
  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where t.tgname = 'lewis_wishlist_entries_touch'
      and n.nspname = 'public'
      and c.relname = 'lewis_wishlist_entries'
  ) then
    create trigger lewis_wishlist_entries_touch
      before update on lewis_wishlist_entries
      for each row execute function lewis_touch_updated_at();
  end if;
end $$;

-- ================================================================
-- Row-level security
-- ================================================================
alter table lewis_binder_entries enable row level security;
alter table lewis_wishlist_entries enable row level security;

-- ---- lewis_binder_entries policies ----

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'lewis_binder_entries'
      and policyname = 'lewis_binder_entries: user owns'
  ) then
    create policy "lewis_binder_entries: user owns"
      on lewis_binder_entries for all
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end $$;

-- Admin read-only policy — unblocks Slice B's aggregate views without
-- giving admins write access to user binders.
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'lewis_binder_entries'
      and policyname = 'lewis_binder_entries: admin read'
  ) then
    create policy "lewis_binder_entries: admin read"
      on lewis_binder_entries for select
      using (public.is_admin(auth.uid()));
  end if;
end $$;

-- ---- lewis_wishlist_entries policies ----

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'lewis_wishlist_entries'
      and policyname = 'lewis_wishlist_entries: user owns'
  ) then
    create policy "lewis_wishlist_entries: user owns"
      on lewis_wishlist_entries for all
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'lewis_wishlist_entries'
      and policyname = 'lewis_wishlist_entries: admin read'
  ) then
    create policy "lewis_wishlist_entries: admin read"
      on lewis_wishlist_entries for select
      using (public.is_admin(auth.uid()));
  end if;
end $$;

-- ================================================================
-- Done. Apply via Supabase Studio SQL editor or `supabase db push`.
-- No destructive tokens anywhere in this file.
-- ================================================================
