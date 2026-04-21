-- ================================================================
-- Phase 6 · Slice B1 · Binder entry provenance
-- ================================================================
-- Adds a provenance marker to binder rows so we can distinguish
-- entries the user added themselves (the default, 'manual') from
-- entries auto-created by downstream flows — currently none, but
-- Slice B2 will land shop-order → binder auto-add once
-- `lewis_orders` exists. Landing the column now so B2 is a pure
-- write-side change rather than a schema migration.
--
-- `source_order_id` is reserved for B2: once `lewis_orders` ships,
-- this column becomes an FK. For now it's a free-form uuid that
-- doesn't reference anything. We accept the temporary loose type
-- rather than creating an empty shell table.
--
-- Conventions: same as 0001 / 0006 — non-destructive, idempotent,
-- `if not exists` guards everywhere. Re-running is a no-op.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. `source` column — 'manual' (default) | 'shop_order' | 'import'
-- ----------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'lewis_binder_entries'
      and column_name = 'source'
  ) then
    alter table public.lewis_binder_entries
      add column source text not null default 'manual'
        check (source in ('manual', 'shop_order', 'import'));
  end if;
end $$;

-- ----------------------------------------------------------------
-- 2. `source_order_id` — nullable pointer to the triggering order.
--    Loosely typed until `lewis_orders` lands (Phase 7 / Slice B2);
--    we'll convert to a proper FK in that migration.
-- ----------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'lewis_binder_entries'
      and column_name = 'source_order_id'
  ) then
    alter table public.lewis_binder_entries
      add column source_order_id uuid;
  end if;
end $$;

-- Index for the auto-add idempotency check ("did this order already
-- land in this user's binder?") — cheap, and we'll query by order id
-- once the B2 worker runs.
create index if not exists idx_lewis_binder_entries_source_order
  on public.lewis_binder_entries(source_order_id)
  where source_order_id is not null;

-- ================================================================
-- Done.
-- ================================================================
