-- ================================================================
-- 0004 · Fix admin-check RLS recursion
--
-- The admin-check policies introduced in 0001 and 0003 all contained
-- a subquery like:
--
--     exists (select 1 from lewis_users u
--             where u.id = auth.uid() and u.role = 'admin')
--
-- Because `lewis_users` itself has an admin policy with that same
-- subquery, Postgres re-enters the policy on every evaluation and
-- errors with `infinite recursion detected in policy for relation
-- "lewis_users"`. This kills every read of lewis_users, which in
-- turn breaks the middleware admin gate + any table that joins
-- through it.
--
-- Fix: move the admin check into a `security definer` function
-- (`public.is_admin`). Definer-privilege functions bypass RLS on
-- their inner reads, so calling `is_admin(auth.uid())` from a
-- policy doesn't re-invoke policies on lewis_users. We then rewrite
-- every previously-recursive policy to call this function.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Helper function
-- ----------------------------------------------------------------
-- `stable` lets the planner cache the result within a single
-- statement. `set search_path = public, pg_temp` prevents a
-- search-path-hijacking attack vector.
create or replace function public.is_admin(u uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.lewis_users
    where id = u and role = 'admin'
  );
$$;

-- Tighten execution rights. No anonymous calls; signed-in users only.
revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated;

-- ----------------------------------------------------------------
-- 2. Replace every recursive admin policy with a call to is_admin().
--    Using `drop policy if exists` + `create policy` (idempotent).
-- ----------------------------------------------------------------

-- 2a. lewis_users: admin read all
drop policy if exists "lewis_users: admin read all" on public.lewis_users;
create policy "lewis_users: admin read all"
  on public.lewis_users for select
  using (public.is_admin(auth.uid()));

-- 2b. lewis_submissions: admin all
drop policy if exists "lewis_submissions: admin all" on public.lewis_submissions;
create policy "lewis_submissions: admin all"
  on public.lewis_submissions for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- 2c. lewis_submission_items: admin all
drop policy if exists "lewis_submission_items: admin all" on public.lewis_submission_items;
create policy "lewis_submission_items: admin all"
  on public.lewis_submission_items for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- 2d. lewis_admin_margins: admin write
drop policy if exists "lewis_admin_margins: admin write" on public.lewis_admin_margins;
create policy "lewis_admin_margins: admin write"
  on public.lewis_admin_margins for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- 2e. lewis_admin_margins_history: admin read
drop policy if exists "lewis_admin_margins_history: admin read" on public.lewis_admin_margins_history;
create policy "lewis_admin_margins_history: admin read"
  on public.lewis_admin_margins_history for select
  using (public.is_admin(auth.uid()));

-- 2f. lewis_admin_margins_history: admin write
drop policy if exists "lewis_admin_margins_history: admin write" on public.lewis_admin_margins_history;
create policy "lewis_admin_margins_history: admin write"
  on public.lewis_admin_margins_history for insert
  with check (public.is_admin(auth.uid()));

-- ================================================================
-- Done. Apply via Supabase Studio SQL editor or `supabase db push`.
-- After this migration, the auth-debug page panels 2 and 4 should
-- return real data instead of the recursion error.
-- ================================================================
