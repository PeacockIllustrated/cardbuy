-- ================================================================
-- Phase 2b · Margin config persistence  (rev 2 — no do-blocks)
-- ================================================================
-- Creates `lewis_admin_margins` (the live config Lewis tunes from
-- /admin/pricing) and `lewis_admin_margins_history` (audit trail —
-- snapshot of the previous row inserted on every update via trigger).
--
-- Single-row philosophy: the app reads `select * from lewis_admin_margins
-- order by created_at desc limit 1` so the row id doesn't matter; the
-- newest row wins. History keeps every revision.
--
-- ────────────────────────────────────────────────────────────────
-- Why no `do $$ ... $$` blocks here:
--   Supabase Studio's SQL editor pre-processes pasted SQL to inject
--   `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` automatically, but
--   its parser doesn't understand dollar-quoted boundaries — it can
--   slice its own ALTER statements *into* a `do $$` block, breaking
--   the SQL with "unterminated dollar-quoted string". So this rev
--   uses only top-level statements:
--     • `create or replace trigger` (PG 14+) for the audit trigger
--     • `drop policy if exists` + `create policy` for idempotent RLS
--       (drops are scoped to OUR `lewis_`-prefixed policy names on
--        our own tables — never touches another project's policies)
--     • `insert ... select ... where not exists` for the seed
-- ────────────────────────────────────────────────────────────────
--
-- Idempotent: re-running this migration is a no-op.
-- Non-destructive: no `delete`, `truncate`, or `drop table`. The
-- `drop policy if exists` lines target only our own namespaced
-- policies on our own tables.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Live margin config — Lewis's dials.
-- ----------------------------------------------------------------
create table if not exists lewis_admin_margins (
  id                         uuid primary key default gen_random_uuid(),

  global_margin              numeric(4, 3) not null default 0.55
                             check (global_margin >= 0 and global_margin <= 1.5),
  min_buy_price              numeric(6, 2) not null default 0.50,
  confidence_threshold       int not null default 3,

  condition_multipliers      jsonb not null default '{
    "NM": 1.00, "LP": 0.85, "MP": 0.65, "HP": 0.45, "DMG": 0.25
  }'::jsonb,

  grade_multipliers          jsonb not null default '{
    "PSA": {"10": 1.00, "9": 0.60, "8": 0.35, "7": 0.20},
    "CGC": {"10": 0.95, "9.5": 0.70, "9": 0.50, "8.5": 0.30},
    "BGS": {"10": 1.00, "9.5": 0.75, "9": 0.50},
    "SGC": {"10": 0.85, "9": 0.50, "8": 0.30},
    "ACE": {"10": 0.90, "9": 0.55}
  }'::jsonb,

  set_overrides              jsonb not null default '[]'::jsonb,
  rarity_overrides           jsonb not null default '[]'::jsonb,

  fx_rate_usd_gbp            numeric(6, 4) not null default 0.7900,
  fx_rate_eur_gbp            numeric(6, 4) not null default 0.8500,
  fx_rate_updated_at         timestamptz,
  fx_manual_override         boolean not null default false,

  created_at                 timestamptz not null default now(),
  created_by                 uuid references lewis_users(id),
  change_note                text
);

-- ----------------------------------------------------------------
-- 2. Audit history — every previous version of the live row.
-- ----------------------------------------------------------------
create table if not exists lewis_admin_margins_history (
  id                 uuid primary key default gen_random_uuid(),
  margin_config_id   uuid not null,
  snapshot           jsonb not null,
  changed_by         uuid references lewis_users(id),
  changed_at         timestamptz not null default now(),
  change_note        text
);

create index if not exists idx_lewis_admin_margins_history_changed
  on lewis_admin_margins_history(changed_at desc);

-- ----------------------------------------------------------------
-- 3. RLS — enable up-front so Studio doesn't auto-inject it later
-- and break statement boundaries.
-- ----------------------------------------------------------------
alter table lewis_admin_margins enable row level security;
alter table lewis_admin_margins_history enable row level security;

-- ----------------------------------------------------------------
-- 4. Snapshot function + trigger
-- ----------------------------------------------------------------
create or replace function lewis_admin_margins_snapshot()
returns trigger
language plpgsql
as $f$
begin
  insert into lewis_admin_margins_history
    (margin_config_id, snapshot, changed_by, change_note)
  values
    (old.id, to_jsonb(old), new.created_by, new.change_note);
  return new;
end;
$f$;

-- `create or replace trigger` is PG 14+; supported on Supabase.
create or replace trigger lewis_admin_margins_snapshot_trg
  before update on lewis_admin_margins
  for each row execute function lewis_admin_margins_snapshot();

-- ----------------------------------------------------------------
-- 5. Policies — drop-then-create for idempotency.
--    Both DROP targets are our own `lewis_`-prefixed policies on
--    our own tables; never touches anything outside our namespace.
-- ----------------------------------------------------------------

-- ---- Live config ----
-- Read: any authenticated user (sellers need it for offer math).
-- Write: admins only.
drop policy if exists "lewis_admin_margins: authenticated read" on lewis_admin_margins;
create policy "lewis_admin_margins: authenticated read"
  on lewis_admin_margins for select
  using (auth.uid() is not null);

drop policy if exists "lewis_admin_margins: admin write" on lewis_admin_margins;
create policy "lewis_admin_margins: admin write"
  on lewis_admin_margins for all
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

-- ---- History ----
-- Read: admins only. Writes happen via the trigger.
drop policy if exists "lewis_admin_margins_history: admin read" on lewis_admin_margins_history;
create policy "lewis_admin_margins_history: admin read"
  on lewis_admin_margins_history for select
  using (
    exists (
      select 1 from lewis_users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );

drop policy if exists "lewis_admin_margins_history: admin write" on lewis_admin_margins_history;
create policy "lewis_admin_margins_history: admin write"
  on lewis_admin_margins_history for insert
  with check (
    exists (
      select 1 from lewis_users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );

-- ----------------------------------------------------------------
-- 6. Seed the initial config row (only if the table is empty).
--    Pure-SQL guard via WHERE NOT EXISTS — no `do $$` block needed.
--    Values mirror lib/mock/mock-margin-config.ts.
-- ----------------------------------------------------------------
insert into lewis_admin_margins (
  global_margin, min_buy_price, confidence_threshold,
  condition_multipliers, grade_multipliers,
  set_overrides, rarity_overrides,
  fx_rate_usd_gbp, fx_rate_eur_gbp,
  fx_rate_updated_at, fx_manual_override,
  change_note
)
select
  0.55, 0.50, 3,
  '{"NM": 1.00, "LP": 0.85, "MP": 0.65, "HP": 0.45, "DMG": 0.25}'::jsonb,
  '{
    "PSA": {"10": 1.00, "9": 0.60, "8": 0.35, "7": 0.20},
    "CGC": {"10": 0.95, "9.5": 0.70, "9": 0.50, "8.5": 0.30},
    "BGS": {"10": 1.00, "9.5": 0.75, "9": 0.50},
    "SGC": {"10": 0.85, "9": 0.50, "8": 0.30},
    "ACE": {"10": 0.90, "9": 0.55}
  }'::jsonb,
  '[]'::jsonb,
  '[
    {"rarity": "Common", "margin": 0.30, "active": true},
    {"rarity": "Secret Rare", "margin": 0.65, "active": true}
  ]'::jsonb,
  0.7900, 0.8500,
  now(), false,
  'Initial seed from migration 0003'
where not exists (select 1 from lewis_admin_margins);

-- ================================================================
-- Done.
--
-- Re-runnable: yes — every statement is idempotent.
-- Studio may still warn about "destructive operations" because of the
-- `drop policy if exists` lines. Those drops only ever target the
-- `lewis_admin_margins:*` and `lewis_admin_margins_history:*` policy
-- names on tables this migration created. They cannot affect any
-- other project's objects.
-- ================================================================
