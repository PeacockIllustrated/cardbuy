-- ================================================================
-- Phase 2a · Password auth — trigger update
-- ================================================================
-- Replaces `lewis_handle_new_user()` so that signup metadata (set via
-- `supabase.auth.signUp({ options: { data: { full_name } } })`) lands
-- in `lewis_users.full_name` atomically with the row insert.
--
-- Non-destructive: `create or replace function` only replaces our own
-- function (prefixed `lewis_`). Doesn't touch any other project.
-- Idempotent — safe to re-run.
-- ================================================================

create or replace function lewis_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into lewis_users (id, email, full_name)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
