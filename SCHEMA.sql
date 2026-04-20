-- ================================================================
-- cardbuy · target schema (Phase 2 — reference only during Phase 1)
-- ================================================================
-- All tables are prefixed `cb_` per CLAUDE.md conventions.
-- Apply with RLS ENABLED on every table.
-- This file is a reference. Do NOT apply during Phase 1 (no DB work in P1).
-- ================================================================

-- ----------------------------------------------------------------
-- Users (Supabase Auth extension)
-- ----------------------------------------------------------------
create table if not exists cb_users (
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

-- ----------------------------------------------------------------
-- Card catalogue (synced from pokemontcg.io nightly)
-- ----------------------------------------------------------------
create table if not exists cb_cards (
  id                text primary key,                -- pokemontcg.io id, e.g. 'base1-4'
  name              text not null,
  set_id            text not null,
  set_name          text not null,
  card_number       text not null,                   -- e.g. '4/102'
  rarity            text,
  language          text default 'EN',
  release_year      int,
  image_url         text,
  image_url_large   text,

  -- Raw prices: NM/LP/MP across normal/holo/reverseHolo variants (pokemontcg.io shape)
  raw_prices        jsonb,

  -- Graded prices: keyed by company → grade → { market, low, high, sale_count }
  graded_prices     jsonb,

  -- Confidence signal
  sale_count_30d    int default 0,

  last_synced       timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists idx_cb_cards_set on cb_cards(set_id);
create index if not exists idx_cb_cards_name on cb_cards using gin(to_tsvector('english', name));

-- ----------------------------------------------------------------
-- Admin margin config — the heart of the business logic
-- ----------------------------------------------------------------
create table if not exists cb_admin_margins (
  id                         uuid primary key default gen_random_uuid(),

  -- Global dials
  global_margin              numeric(4,3) not null default 0.55,     -- pay 55% by default
  min_buy_price              numeric(6,2) not null default 0.50,
  confidence_threshold       int not null default 3,                 -- min 30d sale count

  -- Multipliers
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

  -- Per-set overrides: { "base1": { "margin": 0.70, "active": true }, ... }
  set_overrides              jsonb not null default '{}'::jsonb,

  -- Per-rarity overrides
  rarity_overrides           jsonb not null default '{}'::jsonb,

  -- FX (can be manually overridden; otherwise refreshed by cron)
  fx_rate_usd_gbp            numeric(6,4) not null default 0.7900,
  fx_rate_updated_at         timestamptz,
  fx_manual_override         boolean not null default false,

  created_at                 timestamptz not null default now(),
  created_by                 uuid references auth.users
);

-- Audit trail for config changes (versioning)
create table if not exists cb_admin_margins_history (
  id                 uuid primary key default gen_random_uuid(),
  margin_config_id   uuid not null,
  snapshot           jsonb not null,           -- full cb_admin_margins row
  changed_by         uuid references auth.users,
  changed_at         timestamptz not null default now(),
  change_note        text
);

-- ----------------------------------------------------------------
-- Submissions
-- ----------------------------------------------------------------
create table if not exists cb_submissions (
  id                 uuid primary key default gen_random_uuid(),
  reference          text not null unique,     -- 'CB-2026-000042'
  seller_id          uuid not null references cb_users(id),

  status             text not null default 'draft' check (status in (
    'draft', 'submitted', 'awaiting_cards', 'received',
    'under_review', 'offer_revised', 'approved', 'paid',
    'rejected', 'returned', 'cancelled'
  )),

  payout_method      text not null check (payout_method in ('paypal', 'store_credit')),
  payout_target      text,                     -- PayPal email or credit account id
  shipping_method    text not null default 'royal_mail_tracked',

  total_offered      numeric(10,2),            -- snapshot at submit time
  total_paid         numeric(10,2),            -- actual amount paid after verification
  margin_config_id   uuid references cb_admin_margins(id),  -- which config was used

  terms_accepted_at  timestamptz,
  submitted_at       timestamptz,
  received_at        timestamptz,
  paid_at            timestamptz,

  notes_internal     text,                     -- admin notes, not seller-visible
  notes_seller       text,                     -- seller-visible status notes

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_cb_submissions_seller on cb_submissions(seller_id);
create index if not exists idx_cb_submissions_status on cb_submissions(status);
create index if not exists idx_cb_submissions_reference on cb_submissions(reference);

-- ----------------------------------------------------------------
-- Submission items — individual cards within a submission
-- ----------------------------------------------------------------
create table if not exists cb_submission_items (
  id                   uuid primary key default gen_random_uuid(),
  submission_id        uuid not null references cb_submissions(id) on delete cascade,
  card_id              text not null references cb_cards(id),

  variant              text not null check (variant in ('raw', 'graded')),
  condition            text,                     -- only if raw
  grading_company      text,                     -- only if graded
  grade                text,                     -- only if graded
  quantity             int not null default 1,

  -- Offer frozen at submission time
  offered_amount_per   numeric(10,2) not null,
  offered_amount_total numeric(10,2) not null,
  offer_breakdown      jsonb not null,           -- full calc trace for audit

  -- Verification (post-arrival)
  verified_condition   text,
  verified_grade       text,
  revised_amount_per   numeric(10,2),
  revised_amount_total numeric(10,2),
  verification_notes   text,
  verified_by          uuid references cb_users(id),
  verified_at          timestamptz,

  created_at           timestamptz not null default now()
);

create index if not exists idx_cb_submission_items_submission on cb_submission_items(submission_id);
create index if not exists idx_cb_submission_items_card on cb_submission_items(card_id);

-- ================================================================
-- SHOPFRONT TABLES (added 2026-04-19 mid-Phase-1 amendment)
-- The buy-side tables above remain unchanged. These tables power the
-- sell-side shopfront. See PHASE1_WIREFRAME.md "MID-PHASE AMENDMENT".
-- ================================================================

-- ----------------------------------------------------------------
-- Listings — individual physical inventory units for sale
-- A listing references one card_id but represents a specific copy
-- (condition or grade, with its own price + stock count).
-- ----------------------------------------------------------------
create table if not exists cb_listings (
  id                 uuid primary key default gen_random_uuid(),
  card_id            text not null references cb_cards(id),
  sku                text not null unique,                -- human-readable, e.g. 'SSA-001-NM-A1'

  variant            text not null check (variant in ('raw', 'graded')),
  condition          text,                                -- only if raw: NM/LP/MP/HP/DMG
  grading_company    text,                                -- only if graded: PSA/CGC/BGS/SGC/ACE
  grade              text,                                -- only if graded: 10/9.5/9/8.5/8/7

  price_gbp          numeric(10,2) not null,              -- the list price shown to buyers
  cost_basis_gbp     numeric(10,2),                       -- what Lewis paid (admin-only, drives margin %)

  qty_in_stock       int not null default 1,
  qty_reserved       int not null default 0,              -- cards in someone's active cart

  status             text not null default 'active' check (status in (
    'active', 'hidden', 'sold_out'
  )),

  is_featured        boolean not null default false,
  featured_priority  int,                                 -- lower = shown first; null when not featured

  condition_notes    text,                                -- free text: "small whitening on back", etc.

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_cb_listings_card on cb_listings(card_id);
create index if not exists idx_cb_listings_status on cb_listings(status);
create index if not exists idx_cb_listings_featured on cb_listings(is_featured, featured_priority)
  where is_featured = true;

-- ----------------------------------------------------------------
-- Orders — buyer purchases from the shopfront
-- ----------------------------------------------------------------
create table if not exists cb_orders (
  id                 uuid primary key default gen_random_uuid(),
  reference          text not null unique,                -- 'CB-ORD-2026-000042'
  buyer_id           uuid references cb_users(id),        -- nullable to allow guest checkout
  buyer_email        text not null,                       -- always captured, even for logged-in
  buyer_name         text not null,
  buyer_phone        text,

  status             text not null default 'pending_payment' check (status in (
    'pending_payment', 'paid', 'packing', 'shipped',
    'delivered', 'refunded', 'cancelled'
  )),

  subtotal_gbp       numeric(10,2) not null,
  shipping_gbp       numeric(10,2) not null default 0,
  total_gbp          numeric(10,2) not null,

  payment_method     text check (payment_method in ('stripe_card', 'paypal_in')),
  payment_reference  text,                                -- Stripe/PayPal txn id
  shipping_method    text not null default 'royal_mail_tracked',
  shipping_address   jsonb not null,                      -- { line1, line2, city, postcode, country }
  tracking_number    text,

  placed_at          timestamptz not null default now(),
  paid_at            timestamptz,
  shipped_at         timestamptz,

  notes_internal     text,                                -- admin-only
  notes_buyer        text,                                -- buyer-visible

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_cb_orders_buyer on cb_orders(buyer_id);
create index if not exists idx_cb_orders_status on cb_orders(status);
create index if not exists idx_cb_orders_reference on cb_orders(reference);

-- ----------------------------------------------------------------
-- Order items — frozen snapshot of listings at purchase time
-- ----------------------------------------------------------------
create table if not exists cb_order_items (
  id                       uuid primary key default gen_random_uuid(),
  order_id                 uuid not null references cb_orders(id) on delete cascade,
  listing_id               uuid not null references cb_listings(id),

  -- Snapshots so historical orders survive listing edits/deletions:
  card_id_snapshot         text not null,
  card_name_snapshot       text not null,
  variant_snapshot         text not null,
  condition_snapshot       text,
  grading_company_snapshot text,
  grade_snapshot           text,

  qty                      int not null default 1,
  unit_price_gbp_snapshot  numeric(10,2) not null,
  line_total_gbp           numeric(10,2) not null,

  created_at               timestamptz not null default now()
);

create index if not exists idx_cb_order_items_order on cb_order_items(order_id);

-- ----------------------------------------------------------------
-- Reference number generators (separate sequences for buy/sell sides)
-- ----------------------------------------------------------------
create sequence if not exists cb_submission_ref_seq start 1;
create sequence if not exists cb_order_ref_seq start 1;

create or replace function cb_generate_submission_ref()
returns text as $$
declare
  seq int;
begin
  seq := nextval('cb_submission_ref_seq');
  return 'CB-' || to_char(now(), 'YYYY') || '-' || lpad(seq::text, 6, '0');
end;
$$ language plpgsql;

create or replace function cb_generate_order_ref()
returns text as $$
declare
  seq int;
begin
  seq := nextval('cb_order_ref_seq');
  return 'CB-ORD-' || to_char(now(), 'YYYY') || '-' || lpad(seq::text, 6, '0');
end;
$$ language plpgsql;

-- ----------------------------------------------------------------
-- RLS (stub — flesh out during Phase 2)
-- ----------------------------------------------------------------
alter table cb_users enable row level security;
alter table cb_cards enable row level security;
alter table cb_admin_margins enable row level security;
alter table cb_admin_margins_history enable row level security;
alter table cb_submissions enable row level security;
alter table cb_submission_items enable row level security;
alter table cb_listings enable row level security;
alter table cb_orders enable row level security;
alter table cb_order_items enable row level security;

-- Sellers can read their own user row; admins can read all.
-- Sellers can read cards (public catalogue). Only admins can write.
-- Sellers can CRUD their own submissions while status = 'draft'.
-- Admins can CRUD all submissions.
-- cb_admin_margins: read all for authenticated users (needed for offer calc on seller side),
--   write only admins.
-- cb_listings: public read for status='active'; admin-only write.
-- cb_orders: buyer can read own orders; admin can read all; admin-only write past 'pending_payment'.
-- (Specific policies defined in Phase 2.)
