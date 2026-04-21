-- ================================================================
-- Phase 3 · Slice A · Pricing schema reconcile
-- ================================================================
-- Migration 0005 defined `lewis_prices`, `lewis_prices_history`, and
-- `lewis_sync_runs` with a column shape the application code never
-- actually used. The sync pipeline + admin actions write to
-- `lewis_cards`, `lewis_card_prices`, `lewis_card_price_history`, and
-- a *differently-shaped* `lewis_sync_runs`. As a result, the pricing
-- scaffold has never successfully executed against a real DB.
--
-- Fix: drop the three divergent tables and recreate them (plus the
-- missing `lewis_cards`) with the column shape the code expects.
-- `lewis_card_tcg_map` from 0005 is correct and is preserved as-is.
--
-- Safety:
--   • Every drop here is of a `lewis_`-prefixed table. No shared /
--     auth / non-project tables are touched.
--   • We drop `lewis_prices_history` before `lewis_prices` because
--     the trigger chain lives on `lewis_prices`; `cascade` would also
--     work but the explicit order is safer to audit.
--   • `lewis_sync_runs` is dropped cascade — any `sync_run_id`
--     references in other (already-dead) tables are collateral.
--   • If for any reason the 0005 tables hold real data (they
--     shouldn't — they can't have been populated by code), back up
--     first. This migration is idempotent: re-running is a no-op
--     because the new tables use `create table if not exists` and the
--     drops are `if exists`.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Drop 0005's divergent tables (and their triggers/functions).
-- ----------------------------------------------------------------
drop trigger if exists lewis_prices_snapshot_trg on public.lewis_prices;
drop function if exists public.lewis_prices_snapshot();

drop table if exists public.lewis_prices_history cascade;
drop table if exists public.lewis_prices cascade;
drop table if exists public.lewis_sync_runs cascade;

-- ----------------------------------------------------------------
-- 2. lewis_cards — catalogue cache the sync pipeline upserts into.
--    `id` matches pokemontcg.io card ids (e.g. 'base1-4'), same
--    convention as every other table that references a card.
-- ----------------------------------------------------------------
create table if not exists lewis_cards (
  id                      text primary key,
  name                    text not null,
  set_id                  text not null,
  set_name                text,
  card_number             text,
  rarity                  text,
  supertype               text,
  language                text not null default 'EN',
  image_url_small         text,
  image_url_large         text,
  -- TCGplayer ids captured from the sync, useful for spot-checks and
  -- debugging. Primary mapping still lives in lewis_card_tcg_map.
  tcgplayer_product_id    integer,
  tcgplayer_group_id      integer,
  last_synced_at          timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists lewis_cards_set_id_idx on lewis_cards(set_id);
create index if not exists lewis_cards_tcg_pid_idx on lewis_cards(tcgplayer_product_id);

do $$ begin
  if not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where t.tgname = 'lewis_cards_touch'
      and n.nspname = 'public' and c.relname = 'lewis_cards'
  ) then
    create trigger lewis_cards_touch
      before update on lewis_cards
      for each row execute function lewis_touch_updated_at();
  end if;
end $$;

alter table lewis_cards enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'lewis_cards'
      and policyname = 'lewis_cards: authenticated read'
  ) then
    create policy "lewis_cards: authenticated read"
      on lewis_cards for select
      to authenticated
      using (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'lewis_cards'
      and policyname = 'lewis_cards: admin write'
  ) then
    create policy "lewis_cards: admin write"
      on lewis_cards for all
      using (public.is_admin(auth.uid()))
      with check (public.is_admin(auth.uid()));
  end if;
end $$;

-- ----------------------------------------------------------------
-- 3. lewis_card_prices — latest USD price per (card, source, variant).
--    Unique constraint lets the sync UPSERT without duplicates.
-- ----------------------------------------------------------------
create table if not exists lewis_card_prices (
  id                      uuid primary key default gen_random_uuid(),
  card_id                 text not null,
  source                  text not null check (source in ('tcgplayer', 'cardmarket')),
  variant                 text not null,
  currency                text not null default 'USD' check (currency in ('USD', 'EUR')),
  price_low               numeric(10, 2),
  price_mid               numeric(10, 2),
  price_market            numeric(10, 2),
  price_high              numeric(10, 2),
  -- `source_updated_at` is the upstream timestamp if known (TCGCSV
  -- exposes none — we fill with sync time); `fetched_at` is ours.
  source_updated_at       timestamptz,
  fetched_at              timestamptz not null default now(),

  constraint lewis_card_prices_uniq unique (card_id, source, variant)
);

create index if not exists lewis_card_prices_card_idx on lewis_card_prices(card_id);
create index if not exists lewis_card_prices_fetched_idx on lewis_card_prices(fetched_at desc);

alter table lewis_card_prices enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'lewis_card_prices'
      and policyname = 'lewis_card_prices: authenticated read'
  ) then
    create policy "lewis_card_prices: authenticated read"
      on lewis_card_prices for select
      to authenticated
      using (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'lewis_card_prices'
      and policyname = 'lewis_card_prices: admin write'
  ) then
    create policy "lewis_card_prices: admin write"
      on lewis_card_prices for all
      using (public.is_admin(auth.uid()))
      with check (public.is_admin(auth.uid()));
  end if;
end $$;

-- ----------------------------------------------------------------
-- 4. lewis_card_price_history — one snapshot row per card/variant/day.
--    Unique-on-day prevents re-running a sync from multiplying rows.
-- ----------------------------------------------------------------
create table if not exists lewis_card_price_history (
  id                      uuid primary key default gen_random_uuid(),
  card_id                 text not null,
  source                  text not null,
  variant                 text not null,
  currency                text not null default 'USD',
  price_market            numeric(10, 2),
  price_low               numeric(10, 2),
  source_updated_at       timestamptz,
  snapshotted_on          date not null,

  constraint lewis_card_price_history_uniq
    unique (card_id, source, variant, snapshotted_on)
);

create index if not exists lewis_card_price_history_card_idx
  on lewis_card_price_history(card_id);
create index if not exists lewis_card_price_history_day_idx
  on lewis_card_price_history(snapshotted_on desc);

alter table lewis_card_price_history enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'lewis_card_price_history'
      and policyname = 'lewis_card_price_history: admin read'
  ) then
    create policy "lewis_card_price_history: admin read"
      on lewis_card_price_history for select
      using (public.is_admin(auth.uid()));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'lewis_card_price_history'
      and policyname = 'lewis_card_price_history: admin write'
  ) then
    create policy "lewis_card_price_history: admin write"
      on lewis_card_price_history for all
      using (public.is_admin(auth.uid()))
      with check (public.is_admin(auth.uid()));
  end if;
end $$;

-- ----------------------------------------------------------------
-- 5. lewis_sync_runs — rebuilt against the columns the code writes.
-- ----------------------------------------------------------------
create table if not exists lewis_sync_runs (
  id                      uuid primary key default gen_random_uuid(),
  kind                    text not null,              -- 'prices', 'fx', future 'graded'
  source                  text,                       -- 'tcgplayer', 'open.er-api', …
  started_at              timestamptz not null default now(),
  finished_at             timestamptz,
  status                  text not null default 'running'
                          check (status in ('running', 'success', 'partial', 'failed')),
  sets_processed          int not null default 0,
  cards_upserted          int not null default 0,
  prices_upserted         int not null default 0,
  errors                  jsonb not null default '[]'::jsonb,
  notes                   text
);

create index if not exists lewis_sync_runs_started_idx
  on lewis_sync_runs(started_at desc);
create index if not exists lewis_sync_runs_kind_idx
  on lewis_sync_runs(kind, started_at desc);

alter table lewis_sync_runs enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'lewis_sync_runs'
      and policyname = 'lewis_sync_runs: admin read'
  ) then
    create policy "lewis_sync_runs: admin read"
      on lewis_sync_runs for select
      using (public.is_admin(auth.uid()));
  end if;
end $$;

-- The sync cron uses a service-role client, which bypasses RLS.
-- We still expose an admin-write policy so a signed-in admin can kick
-- off a sync via the UI without service-role escalation.
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'lewis_sync_runs'
      and policyname = 'lewis_sync_runs: admin write'
  ) then
    create policy "lewis_sync_runs: admin write"
      on lewis_sync_runs for all
      using (public.is_admin(auth.uid()))
      with check (public.is_admin(auth.uid()));
  end if;
end $$;

-- ================================================================
-- Done.
-- ================================================================
