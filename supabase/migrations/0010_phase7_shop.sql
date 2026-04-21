-- ================================================================
-- Phase 7 · Shop persistence
-- ================================================================
-- Adds the tables + RPC + triggers + RLS needed to run the shopfront
-- against real data. Payment integration is NOT in this migration —
-- orders land at `status='pending_payment'` with `payment_method='stub'`
-- until Phase 8 wires Stripe.
--
-- Conventions: same as 0001/0006–0009. Idempotent, non-destructive.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. lewis_listings — individual physical inventory units
-- ----------------------------------------------------------------
create table if not exists lewis_listings (
  id                   uuid primary key default gen_random_uuid(),
  card_id              text not null,
  sku                  text not null unique,

  variant              text not null check (variant in ('raw', 'graded')),
  condition            text check (condition in ('NM','LP','MP','HP','DMG')),
  grading_company      text check (grading_company in ('PSA','CGC','BGS','SGC','ACE')),
  grade                text check (grade in ('10','9.5','9','8.5','8','7')),

  price_gbp            numeric(10, 2) not null check (price_gbp >= 0),
  cost_basis_gbp       numeric(10, 2) not null check (cost_basis_gbp >= 0),

  qty_in_stock         int not null default 0 check (qty_in_stock >= 0),
  qty_reserved         int not null default 0 check (qty_reserved >= 0),

  status               text not null default 'active'
                         check (status in ('active', 'hidden', 'sold_out')),

  is_featured          boolean not null default false,
  featured_priority    int,
  condition_notes      text,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint lewis_listings_shape_check check (
    (variant = 'raw'    and condition is not null and grading_company is null and grade is null)
    or
    (variant = 'graded' and condition is null and grading_company is not null and grade is not null)
  ),

  constraint lewis_listings_reserve_cap check (qty_reserved <= qty_in_stock)
);

create index if not exists idx_lewis_listings_status
  on lewis_listings(status);
create index if not exists idx_lewis_listings_card
  on lewis_listings(card_id);
create index if not exists idx_lewis_listings_featured_active
  on lewis_listings(featured_priority) where is_featured and status = 'active';

do $$ begin
  if not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where t.tgname = 'lewis_listings_touch'
      and n.nspname = 'public' and c.relname = 'lewis_listings'
  ) then
    create trigger lewis_listings_touch
      before update on lewis_listings
      for each row execute function lewis_touch_updated_at();
  end if;
end $$;

-- ----------------------------------------------------------------
-- 2. Order reference generator — 'CB-ORD-YYYY-NNNNNN'
-- ----------------------------------------------------------------
create sequence if not exists lewis_order_ref_seq start 1;

create or replace function lewis_generate_order_ref()
returns text
language plpgsql
as $$
declare
  seq int;
begin
  seq := nextval('lewis_order_ref_seq');
  return 'CB-ORD-' || to_char(now(), 'YYYY') || '-' || lpad(seq::text, 6, '0');
end;
$$;

-- ----------------------------------------------------------------
-- 3. lewis_orders — customer shop orders
-- ----------------------------------------------------------------
create table if not exists lewis_orders (
  id                   uuid primary key default gen_random_uuid(),
  reference            text not null unique default lewis_generate_order_ref(),
  -- Buyer can delete their account; snapshot survives so Lewis still
  -- has fulfillment / accounting records.
  buyer_id             uuid references auth.users(id) on delete set null,
  buyer_email          text not null,
  buyer_name           text not null,

  status               text not null default 'pending_payment' check (status in (
    'pending_payment', 'paid', 'packing', 'shipped',
    'delivered', 'refunded', 'cancelled'
  )),

  subtotal_gbp         numeric(10, 2) not null check (subtotal_gbp >= 0),
  shipping_gbp         numeric(10, 2) not null default 0 check (shipping_gbp >= 0),
  total_gbp            numeric(10, 2) not null check (total_gbp >= 0),

  payment_method       text not null default 'stub' check (payment_method in
    ('stripe_card', 'paypal_in', 'stub')),
  shipping_method      text not null default 'royal_mail_tracked' check (shipping_method in
    ('royal_mail_tracked', 'royal_mail_special')),

  shipping_address     jsonb not null,
  tracking_number      text,

  -- Phase 6 Slice B2 hook. Default TRUE — we ask users at checkout
  -- and default the box to opt-in (GDPR note: this is first-party
  -- data use, not marketing, so opt-in-by-default is legal here;
  -- marketing consent still lives in lewis_users per migration 0008).
  add_to_binder_opt_in boolean not null default true,
  binder_entries_created_at timestamptz,

  placed_at            timestamptz not null default now(),
  paid_at              timestamptz,
  shipped_at           timestamptz,
  delivered_at         timestamptz,
  cancelled_at         timestamptz,

  notes_internal       text,
  notes_buyer          text,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_lewis_orders_buyer
  on lewis_orders(buyer_id);
create index if not exists idx_lewis_orders_status
  on lewis_orders(status);
create index if not exists idx_lewis_orders_placed_at
  on lewis_orders(placed_at desc);

do $$ begin
  if not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where t.tgname = 'lewis_orders_touch'
      and n.nspname = 'public' and c.relname = 'lewis_orders'
  ) then
    create trigger lewis_orders_touch
      before update on lewis_orders
      for each row execute function lewis_touch_updated_at();
  end if;
end $$;

-- ----------------------------------------------------------------
-- 4. lewis_order_items — one row per listing per order
-- ----------------------------------------------------------------
create table if not exists lewis_order_items (
  id                   uuid primary key default gen_random_uuid(),
  order_id             uuid not null references lewis_orders(id) on delete cascade,
  listing_id           uuid not null references lewis_listings(id) on delete restrict,

  -- Snapshots, not live joins — receipts must stay stable if the
  -- underlying listing changes or is hidden later.
  card_id              text not null,
  card_name            text not null,
  set_name             text not null,
  variant              text not null check (variant in ('raw', 'graded')),
  condition            text,
  grading_company      text,
  grade                text,

  qty                  int not null check (qty > 0),
  unit_price_gbp       numeric(10, 2) not null check (unit_price_gbp >= 0),
  line_total_gbp       numeric(10, 2) not null check (line_total_gbp >= 0),

  created_at           timestamptz not null default now()
);

create index if not exists idx_lewis_order_items_order
  on lewis_order_items(order_id);
create index if not exists idx_lewis_order_items_listing
  on lewis_order_items(listing_id);

-- ----------------------------------------------------------------
-- 5. Atomic order-creation RPC
-- ----------------------------------------------------------------
-- Single source of truth for creating an order. Locks listings
-- FOR UPDATE, validates stock, inserts order + items, bumps
-- reservation counters, returns the new order id + reference.
--
-- Takes cart items as a jsonb array:
--   [{ listing_id: uuid, qty: int }]
-- plus the usual address/payment shape.
--
-- Raises 'OUT_OF_STOCK' if any line can't be satisfied so the caller
-- can surface a clean error. Everything is atomic — either the whole
-- order lands or nothing does.
create or replace function lewis_create_order(
  p_buyer_id uuid,
  p_buyer_email text,
  p_buyer_name text,
  p_cart jsonb,                   -- [{listing_id, qty}]
  p_shipping_address jsonb,
  p_shipping_method text,
  p_shipping_gbp numeric,
  p_payment_method text,
  p_add_to_binder_opt_in boolean,
  p_notes_buyer text default null
)
returns table(id uuid, reference text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_id uuid;
  v_ref text;
  v_subtotal numeric := 0;
  v_line record;
  v_listing record;
  v_card_name text;
  v_set_id text;
begin
  if jsonb_array_length(p_cart) = 0 then
    raise exception 'EMPTY_CART';
  end if;

  -- Validate + lock every listing row up front. Keeps the remaining
  -- work inside a consistent snapshot.
  for v_line in
    select
      (elem->>'listing_id')::uuid as listing_id,
      (elem->>'qty')::int         as qty
    from jsonb_array_elements(p_cart) as elem
  loop
    select
      l.id, l.card_id, l.variant, l.condition, l.grading_company,
      l.grade, l.price_gbp, l.status, l.qty_in_stock, l.qty_reserved
    into v_listing
    from public.lewis_listings l
    where l.id = v_line.listing_id
    for update;

    if v_listing is null then
      raise exception 'LISTING_NOT_FOUND: %', v_line.listing_id;
    end if;
    if v_listing.status <> 'active' then
      raise exception 'LISTING_INACTIVE: %', v_line.listing_id;
    end if;
    if (v_listing.qty_in_stock - v_listing.qty_reserved) < v_line.qty then
      raise exception 'OUT_OF_STOCK: %', v_line.listing_id;
    end if;

    v_subtotal := v_subtotal + v_listing.price_gbp * v_line.qty;
  end loop;

  -- Create the order.
  v_ref := lewis_generate_order_ref();
  insert into public.lewis_orders (
    reference, buyer_id, buyer_email, buyer_name,
    subtotal_gbp, shipping_gbp, total_gbp,
    payment_method, shipping_method,
    shipping_address, add_to_binder_opt_in, notes_buyer
  ) values (
    v_ref, p_buyer_id, p_buyer_email, p_buyer_name,
    v_subtotal, p_shipping_gbp, v_subtotal + p_shipping_gbp,
    p_payment_method, p_shipping_method,
    p_shipping_address, p_add_to_binder_opt_in, p_notes_buyer
  )
  returning lewis_orders.id into v_order_id;

  -- Insert items, bumping reservations as we go.
  for v_line in
    select
      (elem->>'listing_id')::uuid as listing_id,
      (elem->>'qty')::int         as qty
    from jsonb_array_elements(p_cart) as elem
  loop
    select
      l.card_id, l.variant, l.condition, l.grading_company,
      l.grade, l.price_gbp
    into v_listing
    from public.lewis_listings l
    where l.id = v_line.listing_id;

    -- Card name / set name are denormalised from the fixture at insert
    -- time. Phase 7 doesn't have a `lewis_cards` table yet so we use
    -- the card_id as a stable fallback — the JS server action writes
    -- the pretty name via a post-insert update using the in-code
    -- fixture. Keeps the RPC pure-SQL.
    v_card_name := v_listing.card_id;
    v_set_id    := split_part(v_listing.card_id, '-', 1);

    insert into public.lewis_order_items (
      order_id, listing_id, card_id, card_name, set_name,
      variant, condition, grading_company, grade,
      qty, unit_price_gbp, line_total_gbp
    ) values (
      v_order_id, v_line.listing_id, v_listing.card_id, v_card_name, v_set_id,
      v_listing.variant, v_listing.condition, v_listing.grading_company, v_listing.grade,
      v_line.qty, v_listing.price_gbp, v_listing.price_gbp * v_line.qty
    );

    update public.lewis_listings
      set qty_reserved = qty_reserved + v_line.qty
      where id = v_line.listing_id;
  end loop;

  return query select v_order_id, v_ref;
end;
$$;

revoke all on function public.lewis_create_order(
  uuid, text, text, jsonb, jsonb, text, numeric, text, boolean, text
) from public;
grant execute on function public.lewis_create_order(
  uuid, text, text, jsonb, jsonb, text, numeric, text, boolean, text
) to authenticated;

-- ----------------------------------------------------------------
-- 6. Release-stock-on-cancel trigger
-- ----------------------------------------------------------------
-- When an order flips to 'cancelled', decrement qty_reserved on
-- every item's listing. Idempotent via `cancelled_at IS NULL` check.
create or replace function lewis_release_on_cancel()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    update public.lewis_listings l
      set qty_reserved = greatest(0, l.qty_reserved - i.qty)
      from public.lewis_order_items i
      where i.order_id = new.id
        and i.listing_id = l.id;
    new.cancelled_at := coalesce(new.cancelled_at, now());
  end if;
  return new;
end;
$$;

do $$ begin
  if not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where t.tgname = 'lewis_orders_release_on_cancel'
      and n.nspname = 'public' and c.relname = 'lewis_orders'
  ) then
    create trigger lewis_orders_release_on_cancel
      before update on lewis_orders
      for each row execute function lewis_release_on_cancel();
  end if;
end $$;

-- ================================================================
-- Row-level security
-- ================================================================
alter table lewis_listings enable row level security;
alter table lewis_orders enable row level security;
alter table lewis_order_items enable row level security;

-- lewis_listings — public read of active rows + admin all
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'lewis_listings'
      and policyname = 'lewis_listings: public read active'
  ) then
    create policy "lewis_listings: public read active"
      on lewis_listings for select
      using (status = 'active');
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'lewis_listings'
      and policyname = 'lewis_listings: admin all'
  ) then
    create policy "lewis_listings: admin all"
      on lewis_listings for all
      using (public.is_admin(auth.uid()))
      with check (public.is_admin(auth.uid()));
  end if;
end $$;

-- lewis_orders — buyer read/write own + admin all
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'lewis_orders'
      and policyname = 'lewis_orders: buyer read own'
  ) then
    create policy "lewis_orders: buyer read own"
      on lewis_orders for select
      using (buyer_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'lewis_orders'
      and policyname = 'lewis_orders: admin all'
  ) then
    create policy "lewis_orders: admin all"
      on lewis_orders for all
      using (public.is_admin(auth.uid()))
      with check (public.is_admin(auth.uid()));
  end if;
end $$;

-- lewis_order_items — visible via parent order
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'lewis_order_items'
      and policyname = 'lewis_order_items: via parent order'
  ) then
    create policy "lewis_order_items: via parent order"
      on lewis_order_items for select
      using (
        exists (
          select 1 from public.lewis_orders o
          where o.id = order_id and o.buyer_id = auth.uid()
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'lewis_order_items'
      and policyname = 'lewis_order_items: admin all'
  ) then
    create policy "lewis_order_items: admin all"
      on lewis_order_items for all
      using (public.is_admin(auth.uid()))
      with check (public.is_admin(auth.uid()));
  end if;
end $$;

-- ================================================================
-- Done.
-- ================================================================
