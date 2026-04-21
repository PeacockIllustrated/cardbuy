-- ================================================================
-- Phase 6 · Slice D · Graded-card framed camera scan
-- ================================================================
-- Adds a `graded_image_url` column to binder entries and creates a
-- private Supabase Storage bucket for the captured slab images.
-- Files are namespaced under `{user_id}/{uuid}.jpg` so RLS on the
-- storage side can scope access per-user cleanly.
--
-- OCR of the grade label is deliberately out of scope for Slice D
-- (see PHASE6_BINDER.md non-goals). The user confirms the grading
-- company + grade manually after capture.
--
-- Conventions: same as 0001/0006–0008. Idempotent, non-destructive.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. graded_image_url column on lewis_binder_entries
-- ----------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'lewis_binder_entries'
      and column_name = 'graded_image_url'
  ) then
    alter table public.lewis_binder_entries
      add column graded_image_url text;
  end if;
end $$;

-- ----------------------------------------------------------------
-- 2. Private storage bucket for slab scans
-- ----------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'graded-scans',
  'graded-scans',
  false,
  5 * 1024 * 1024,            -- 5 MB cap per scan
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- ----------------------------------------------------------------
-- 3. Storage policies — user-scoped by folder prefix
-- ----------------------------------------------------------------
-- Upload: authenticated users may write only to paths starting with
-- their own auth.uid(). The scanner server action enforces this
-- shape, but RLS is the backstop.

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'graded-scans: user uploads own folder'
  ) then
    create policy "graded-scans: user uploads own folder"
      on storage.objects for insert
      to authenticated
      with check (
        bucket_id = 'graded-scans'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'graded-scans: user reads own folder'
  ) then
    create policy "graded-scans: user reads own folder"
      on storage.objects for select
      to authenticated
      using (
        bucket_id = 'graded-scans'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'graded-scans: user deletes own folder'
  ) then
    create policy "graded-scans: user deletes own folder"
      on storage.objects for delete
      to authenticated
      using (
        bucket_id = 'graded-scans'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;

-- Admin read-all — unblocks verification flows later without giving
-- admins write access to user scans.
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'graded-scans: admin reads all'
  ) then
    create policy "graded-scans: admin reads all"
      on storage.objects for select
      to authenticated
      using (
        bucket_id = 'graded-scans'
        and public.is_admin(auth.uid())
      );
  end if;
end $$;

-- ================================================================
-- Done.
-- ================================================================
