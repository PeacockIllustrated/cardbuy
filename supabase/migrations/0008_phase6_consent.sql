-- ================================================================
-- Phase 6 · Slice C1 · Consent columns on lewis_users
-- ================================================================
-- UK GDPR + PECR split: marketing consent is independent of terms
-- acceptance. We need granular opt-ins so a signed-up user is not
-- implicitly fair game for every email type.
--
-- Column shape — four booleans, each one question:
--   consent_service_emails    — transactional (submissions, orders).
--                               Defaults TRUE; can't legally opt out of
--                               essential service mail.
--   consent_marketing_buylist — "we want to buy your cards" offers.
--   consent_marketing_shop    — wishlist stock alerts, new drops.
--   consent_aggregate_data    — anonymised portfolio data for pricing
--                               intelligence. Opt-in.
--   consent_updated_at        — audit timestamp, bumped on change.
--   privacy_policy_accepted_at — nullable; null means user hasn't yet
--                               reviewed the post-0008 consent surface.
--
-- All new marketing booleans default FALSE per CONCEPT_BINDER.md.
-- Existing rows get the defaults on ADD COLUMN — no data churn.
--
-- Conventions: same as 0001/0006/0007. Idempotent, non-destructive.
-- ================================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'lewis_users'
      and column_name = 'consent_service_emails'
  ) then
    alter table public.lewis_users
      add column consent_service_emails boolean not null default true;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'lewis_users'
      and column_name = 'consent_marketing_buylist'
  ) then
    alter table public.lewis_users
      add column consent_marketing_buylist boolean not null default false;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'lewis_users'
      and column_name = 'consent_marketing_shop'
  ) then
    alter table public.lewis_users
      add column consent_marketing_shop boolean not null default false;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'lewis_users'
      and column_name = 'consent_aggregate_data'
  ) then
    alter table public.lewis_users
      add column consent_aggregate_data boolean not null default false;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'lewis_users'
      and column_name = 'consent_updated_at'
  ) then
    alter table public.lewis_users
      add column consent_updated_at timestamptz;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'lewis_users'
      and column_name = 'privacy_policy_accepted_at'
  ) then
    alter table public.lewis_users
      add column privacy_policy_accepted_at timestamptz;
  end if;
end $$;

-- ================================================================
-- Done. Slice C1 only touches lewis_users. Cascade-delete of the
-- auth.users row cleans binder + wishlist + submissions via the FKs
-- already established in 0001 and 0006.
-- ================================================================
