-- ================================================================
-- 0005 · Phase 3 · Price ingestion schema
--
-- Introduces three tables that together back the real pricing engine:
--
--   lewis_card_tcg_map      — cardId ↔ TCGplayer productId lookup,
--                             populated by the mapping builder.
--   lewis_prices            — one row per (card_id, sub_type_name)
--                             variant, UPSERT on every sync run.
--   lewis_prices_history    — audit trail: the OLD price is copied
--                             here by trigger before an UPDATE.
--   lewis_sync_runs         — one row per sync job (cron or manual),
--                             so the admin dashboard can show "last
--                             synced / row count / errors / duration".
--
-- All admin-write policies use the `public.is_admin(uuid)` helper
-- from migration 0004 to avoid RLS recursion. Authenticated reads
-- are permitted on the mapping + prices so seller-facing offer
-- calculations can resolve prices without needing service-role.
--
-- Idempotent: every create wraps in IF NOT EXISTS / do $$ begin …
-- end $$, no destructive statements anywhere in this file.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. lewis_card_tcg_map — cardId to productId lookup
-- ----------------------------------------------------------------
create table if not exists lewis_card_tcg_map (
  card_id             text primary key,
  product_id          integer not null,
  -- Mapping quality. `exact` = number + name both match (possibly
  -- via Levenshtein). `number-only` = number matches but name is
  -- genuinely different. `name-fuzzy` = no number match, name-only
  -- fallback. `manual` = hand-curated override (e.g. Machamp).
  confidence          text not null default 'exact'
                      check (confidence in ('exact','number-only','name-fuzzy','manual')),
  -- `auto` = seeded by buildMapping(); `manual-override` = admin
  -- inserted / updated by hand. Rows with `manual-override` are
  -- preserved across re-seeds.
  source              text not null default 'auto'
                      check (source in ('auto','manual-override')),
  -- TCGCSV group the productId lives in — useful when a card sits
  -- outside the primary set group (e.g. Base Set Machamp is in
  -- group 1663, not group 604).
  tcg_group_id        integer,
  notes               text,
  verified_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Distinct productIds across all card_ids (a productId should only
-- ever point at one canonical local card).
create unique index if not exists lewis_card_tcg_map_product_id_uq
  on lewis_card_tcg_map(product_id);

alter table lewis_card_tcg_map enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lewis_card_tcg_map' and policyname = 'lewis_card_tcg_map: authenticated read') then
    create policy "lewis_card_tcg_map: authenticated read"
      on lewis_card_tcg_map for select
      to authenticated
      using (true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lewis_card_tcg_map' and policyname = 'lewis_card_tcg_map: admin write') then
    create policy "lewis_card_tcg_map: admin write"
      on lewis_card_tcg_map for all
      using (public.is_admin(auth.uid()))
      with check (public.is_admin(auth.uid()));
  end if;
end $$;

-- ----------------------------------------------------------------
-- 2. lewis_prices — latest market data, one row per variant
-- ----------------------------------------------------------------
create table if not exists lewis_prices (
  id                  uuid primary key default gen_random_uuid(),
  card_id             text not null references lewis_card_tcg_map(card_id) on delete cascade,
  product_id          integer not null,
  -- Matches TCGCSV's `subTypeName` values exactly: "Normal",
  -- "Holofoil", "Reverse Holofoil", "1st Edition Holofoil",
  -- "Unlimited Holofoil", "Shadowless Holofoil", etc.
  sub_type_name       text not null,
  low_usd             numeric(10,2),
  mid_usd             numeric(10,2),
  high_usd            numeric(10,2),
  -- `market_usd` is the anchor the Phase 3 offer formula reads.
  -- The other columns are retained for audit + admin UI context.
  market_usd          numeric(10,2),
  direct_low_usd      numeric(10,2),
  -- ID of the sync run that produced this row.
  sync_run_id         uuid,
  synced_at           timestamptz not null default now(),
  unique (card_id, sub_type_name)
);

create index if not exists lewis_prices_card_id_idx on lewis_prices(card_id);
create index if not exists lewis_prices_synced_at_idx on lewis_prices(synced_at desc);

alter table lewis_prices enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lewis_prices' and policyname = 'lewis_prices: authenticated read') then
    create policy "lewis_prices: authenticated read"
      on lewis_prices for select
      to authenticated
      using (true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lewis_prices' and policyname = 'lewis_prices: admin write') then
    create policy "lewis_prices: admin write"
      on lewis_prices for all
      using (public.is_admin(auth.uid()))
      with check (public.is_admin(auth.uid()));
  end if;
end $$;

-- ----------------------------------------------------------------
-- 3. lewis_prices_history — audit trail on every UPDATE / DELETE
-- ----------------------------------------------------------------
create table if not exists lewis_prices_history (
  id                  uuid primary key default gen_random_uuid(),
  price_id            uuid not null,
  card_id             text not null,
  product_id          integer not null,
  sub_type_name       text not null,
  low_usd             numeric(10,2),
  mid_usd             numeric(10,2),
  high_usd            numeric(10,2),
  market_usd          numeric(10,2),
  direct_low_usd      numeric(10,2),
  sync_run_id         uuid,
  synced_at           timestamptz not null,
  -- When this history row was written (i.e. when the UPDATE happened).
  archived_at         timestamptz not null default now(),
  archive_reason      text not null default 'update'
                      check (archive_reason in ('update','delete'))
);

create index if not exists lewis_prices_history_card_id_idx on lewis_prices_history(card_id);
create index if not exists lewis_prices_history_archived_at_idx on lewis_prices_history(archived_at desc);

alter table lewis_prices_history enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lewis_prices_history' and policyname = 'lewis_prices_history: admin read') then
    create policy "lewis_prices_history: admin read"
      on lewis_prices_history for select
      using (public.is_admin(auth.uid()));
  end if;
end $$;

-- Trigger function: copy the OLD row into history on every UPDATE
-- or DELETE. INSERTs aren't archived — the first write of a row
-- isn't a change from anything.
create or replace function public.lewis_prices_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into lewis_prices_history (
    price_id, card_id, product_id, sub_type_name,
    low_usd, mid_usd, high_usd, market_usd, direct_low_usd,
    sync_run_id, synced_at, archive_reason
  )
  values (
    old.id, old.card_id, old.product_id, old.sub_type_name,
    old.low_usd, old.mid_usd, old.high_usd, old.market_usd, old.direct_low_usd,
    old.sync_run_id, old.synced_at,
    case when tg_op = 'DELETE' then 'delete' else 'update' end
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists lewis_prices_snapshot_trg on lewis_prices;
create trigger lewis_prices_snapshot_trg
  before update or delete on lewis_prices
  for each row
  execute function public.lewis_prices_snapshot();

-- ----------------------------------------------------------------
-- 4. lewis_sync_runs — one row per sync job invocation
-- ----------------------------------------------------------------
create table if not exists lewis_sync_runs (
  id                  uuid primary key default gen_random_uuid(),
  -- 'cron' for scheduled, 'manual' for admin-button, 'seed' for
  -- initial bulk imports.
  trigger             text not null default 'manual'
                      check (trigger in ('cron','manual','seed')),
  triggered_by        uuid references lewis_users(id),
  started_at          timestamptz not null default now(),
  finished_at         timestamptz,
  -- Aggregate counts — filled in when the job finishes.
  rows_upserted       integer not null default 0,
  rows_skipped        integer not null default 0,
  errors_count        integer not null default 0,
  -- Free-form payload: which sets were synced, any error messages,
  -- per-set counts. Stored as JSONB for structured querying.
  summary             jsonb,
  error_message       text,
  status              text not null default 'running'
                      check (status in ('running','ok','partial','failed'))
);

create index if not exists lewis_sync_runs_started_at_idx on lewis_sync_runs(started_at desc);

alter table lewis_sync_runs enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lewis_sync_runs' and policyname = 'lewis_sync_runs: admin read') then
    create policy "lewis_sync_runs: admin read"
      on lewis_sync_runs for select
      using (public.is_admin(auth.uid()));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lewis_sync_runs' and policyname = 'lewis_sync_runs: admin write') then
    create policy "lewis_sync_runs: admin write"
      on lewis_sync_runs for all
      using (public.is_admin(auth.uid()))
      with check (public.is_admin(auth.uid()));
  end if;
end $$;

-- ================================================================
-- Done. Apply via the Supabase Studio SQL editor. The mapping
-- table is empty until slice 3b's server action seeds it from
-- `buildMapping()`.
-- ================================================================
