-- ================================================================
-- Phase 2a · Auth + Submission persistence
-- ================================================================
-- Creates only the tables needed to let authenticated sellers save
-- submissions. The card catalogue (`lewis_cards`), pricing config
-- (`lewis_admin_margins`), shopfront tables, and their crons land in
-- Phase 2b.
--
-- Naming: every object prefixed `lewis_` (operator instruction —
-- these tables live alongside other projects in the same Supabase
-- org / auth schema).
--
-- Non-destructive by construction:
--   • No `drop`, `delete`, `truncate`, `alter column`, or `alter type`.
--   • Every create statement is guarded (`if not exists` for tables /
--     sequences / indexes, or a `do $$` existence check for triggers
--     and policies — Postgres has no `create trigger if not exists`
--     or `create policy if not exists`).
--   • `create or replace function` only replaces functions we own
--     (all prefixed `lewis_`). It's not a drop.
--   • The only touch on a shared object (`auth.users`) is a trigger
--     we add, named `lewis_on_auth_user_created` so we can never
--     collide with another project's hook.
--
-- Idempotent: re-running this migration is a no-op.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Users — extends auth.users with profile + role.
-- ----------------------------------------------------------------
create table if not exists lewis_users (
  id                uuid primary key references auth.users on delete cascade,
  email             text not null,
  full_name         text,
  phone             text,
  postcode          text,
  country           text default 'GB',
  role              text not null default 'seller' check (role in ('seller', 'admin')),
  paypal_email      text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Trigger: auto-insert a lewis_users row when a new auth.users row
-- is created (magic-link sign-up). Keeps profile in lock-step with
-- Supabase Auth.
create or replace function lewis_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into lewis_users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Guarded trigger creation on the SHARED auth.users table. Only fires
-- the create if our specifically-named trigger isn't already present.
-- Never touches any other project's triggers.
do $$
begin
  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where t.tgname = 'lewis_on_auth_user_created'
      and n.nspname = 'auth'
      and c.relname = 'users'
  ) then
    create trigger lewis_on_auth_user_created
      after insert on auth.users
      for each row execute function lewis_handle_new_user();
  end if;
end $$;

-- ----------------------------------------------------------------
-- 2. Submission reference generator — 'CB-YYYY-NNNNNN'
-- (reference format kept per CLAUDE.md §04)
-- ----------------------------------------------------------------
create sequence if not exists lewis_submission_ref_seq start 1;

create or replace function lewis_generate_submission_ref()
returns text
language plpgsql
as $$
declare
  seq int;
begin
  seq := nextval('lewis_submission_ref_seq');
  return 'CB-' || to_char(now(), 'YYYY') || '-' || lpad(seq::text, 6, '0');
end;
$$;

-- ----------------------------------------------------------------
-- 3. Submissions — seller buylist packages.
-- ----------------------------------------------------------------
create table if not exists lewis_submissions (
  id                 uuid primary key default gen_random_uuid(),
  reference          text not null unique default lewis_generate_submission_ref(),
  seller_id          uuid not null references lewis_users(id) on delete cascade,

  status             text not null default 'draft' check (status in (
    'draft', 'submitted', 'awaiting_cards', 'received',
    'under_review', 'offer_revised', 'approved', 'paid',
    'rejected', 'returned', 'cancelled'
  )),

  payout_method      text check (payout_method in ('paypal', 'store_credit')),
  payout_target      text,
  shipping_method    text not null default 'royal_mail_tracked',

  total_offered      numeric(10, 2),
  total_paid         numeric(10, 2),

  -- Phase 2b will populate this once lewis_admin_margins exists.
  margin_config_id   uuid,

  terms_accepted_at  timestamptz,
  submitted_at       timestamptz,
  received_at        timestamptz,
  paid_at            timestamptz,

  notes_internal     text,
  notes_seller       text,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_lewis_submissions_seller
  on lewis_submissions(seller_id);
create index if not exists idx_lewis_submissions_status
  on lewis_submissions(status);

-- Bump updated_at on every row change.
create or replace function lewis_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Guarded trigger creation — only adds if missing.
do $$
begin
  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where t.tgname = 'lewis_submissions_touch'
      and n.nspname = 'public'
      and c.relname = 'lewis_submissions'
  ) then
    create trigger lewis_submissions_touch
      before update on lewis_submissions
      for each row execute function lewis_touch_updated_at();
  end if;
end $$;

-- ----------------------------------------------------------------
-- 4. Submission items — one card line per row.
-- NOTE: card_id is NOT foreign-keyed to lewis_cards yet — that table
-- lands in Phase 2b. Stored values are pokemontcg.io ids
-- (e.g. 'base1-4'); readers resolve names via the in-code fixture.
-- ----------------------------------------------------------------
create table if not exists lewis_submission_items (
  id                   uuid primary key default gen_random_uuid(),
  submission_id        uuid not null references lewis_submissions(id) on delete cascade,
  card_id              text not null,

  variant              text not null check (variant in ('raw', 'graded')),
  condition            text check (condition in ('NM', 'LP', 'MP', 'HP', 'DMG')),
  grading_company      text check (grading_company in ('PSA', 'CGC', 'BGS', 'SGC', 'ACE')),
  grade                text,
  quantity             int not null default 1 check (quantity > 0),

  offered_amount_per   numeric(10, 2) not null,
  offered_amount_total numeric(10, 2) not null,
  offer_breakdown      jsonb not null default '{}'::jsonb,

  -- Verification fields reserved for Phase 4 (post-arrival workflow).
  verified_condition   text,
  verified_grade       text,
  revised_amount_per   numeric(10, 2),
  revised_amount_total numeric(10, 2),
  verification_notes   text,
  verified_by          uuid references lewis_users(id),
  verified_at          timestamptz,

  created_at           timestamptz not null default now()
);

create index if not exists idx_lewis_submission_items_submission
  on lewis_submission_items(submission_id);
create index if not exists idx_lewis_submission_items_card
  on lewis_submission_items(card_id);

-- ================================================================
-- Row-level security — enables + policies
-- ================================================================
-- `alter table ... enable row level security` is natively idempotent
-- in Postgres — running it on an already-RLS-enabled table is a
-- silent no-op. Kept at the top level (not inside a `do $$` block)
-- so Supabase Studio's linter can see RLS is on for every table we
-- create.
alter table lewis_users enable row level security;
alter table lewis_submissions enable row level security;
alter table lewis_submission_items enable row level security;

-- ---- Policies ----
-- Each policy is wrapped in a `do $$` existence check. If we ever need
-- to change a policy definition we write a NEW migration that renames
-- or explicitly drops-and-recreates — never silently in this file.

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lewis_users' and policyname = 'lewis_users: self read') then
    create policy "lewis_users: self read"
      on lewis_users for select
      using (auth.uid() = id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lewis_users' and policyname = 'lewis_users: self update') then
    create policy "lewis_users: self update"
      on lewis_users for update
      using (auth.uid() = id)
      with check (auth.uid() = id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lewis_users' and policyname = 'lewis_users: admin read all') then
    create policy "lewis_users: admin read all"
      on lewis_users for select
      using (
        exists (
          select 1 from lewis_users u
          where u.id = auth.uid() and u.role = 'admin'
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lewis_submissions' and policyname = 'lewis_submissions: seller owns') then
    create policy "lewis_submissions: seller owns"
      on lewis_submissions for all
      using (seller_id = auth.uid())
      with check (seller_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lewis_submissions' and policyname = 'lewis_submissions: admin all') then
    create policy "lewis_submissions: admin all"
      on lewis_submissions for all
      using (
        exists (
          select 1 from lewis_users u
          where u.id = auth.uid() and u.role = 'admin'
        )
      )
      with check (
        exists (
          select 1 from lewis_users u
          where u.id = auth.uid() and u.role = 'admin'
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lewis_submission_items' and policyname = 'lewis_submission_items: seller owns') then
    create policy "lewis_submission_items: seller owns"
      on lewis_submission_items for all
      using (
        exists (
          select 1 from lewis_submissions s
          where s.id = submission_id and s.seller_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1 from lewis_submissions s
          where s.id = submission_id and s.seller_id = auth.uid()
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lewis_submission_items' and policyname = 'lewis_submission_items: admin all') then
    create policy "lewis_submission_items: admin all"
      on lewis_submission_items for all
      using (
        exists (
          select 1 from lewis_users u
          where u.id = auth.uid() and u.role = 'admin'
        )
      )
      with check (
        exists (
          select 1 from lewis_users u
          where u.id = auth.uid() and u.role = 'admin'
        )
      );
  end if;
end $$;

-- ================================================================
-- Done. Apply via Supabase Studio SQL editor or `supabase db push`.
-- No destructive tokens (`drop`, `delete`, `truncate`) anywhere in
-- this file — every object is created only when absent.
-- ================================================================
