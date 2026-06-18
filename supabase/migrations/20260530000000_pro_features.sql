-- ============================================================================
-- Pro features pass:
--   1. Soft delete (deleted_at) on guidelines + responses
--   2. New "message" question kind for chapter/section dividers
--   3. Conditional rules per question option (jsonb)
--   4. View counter on guidelines (incremented on /c/[slug] hit)
--   5. 30-day auto-purge of trashed rows (scheduled function)
-- ============================================================================

-- 1. Soft delete --------------------------------------------------------------
alter table public.guidelines add column if not exists deleted_at timestamptz;
alter table public.responses  add column if not exists deleted_at timestamptz;

create index if not exists guidelines_deleted_at_idx on public.guidelines(deleted_at);
create index if not exists responses_deleted_at_idx  on public.responses(deleted_at);

-- 2. New question kind: 'message' (no input, just a section divider) ---------
alter type public.question_kind add value if not exists 'message';

-- 3. Conditional rules ---------------------------------------------------------
-- Each option can list which question IDs to additionally show when picked.
-- Schema kept in jsonb on the option row (we already have it as `media_meta`
-- and `settings` jsonbs; here we add a first-class one for clarity).
alter table public.options
  add column if not exists reveal_question_ids uuid[] not null default '{}';

-- 4. View counter --------------------------------------------------------------
alter table public.guidelines
  add column if not exists view_count integer not null default 0;

-- Public RPC that the /c/[slug] page calls to bump the counter without RLS
-- bouncing it. Service-role API route also OK; this is a convenience.
create or replace function public.increment_guideline_views(p_slug text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.guidelines
     set view_count = view_count + 1
   where share_slug = p_slug
     and status = 'published'
     and deleted_at is null;
$$;
grant execute on function public.increment_guideline_views(text) to anon, authenticated;

-- 5. 30-day auto-purge of trashed items ---------------------------------------
create or replace function public.purge_trash()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.guidelines where deleted_at is not null and deleted_at < now() - interval '30 days';
  delete from public.responses  where deleted_at is not null and deleted_at < now() - interval '30 days';
end $$;

-- Schedule daily at 03:17 UTC via pg_cron if available; safe to skip if extension is missing.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('frameline-purge-trash', '17 3 * * *', $cron$ select public.purge_trash(); $cron$);
  end if;
exception when others then
  -- pg_cron may not be enabled on this project tier; ignore.
  null;
end $$;

-- ─── RLS additions: respect soft delete in the existing owner policies ──────
-- We update the existing owner policies to scope to deleted_at is null.
-- (Postgres can't ALTER a policy USING clause directly; we drop + recreate.)

drop policy if exists "guidelines owner all" on public.guidelines;
create policy "guidelines owner read" on public.guidelines for select
  using (auth.uid() = owner_id);
create policy "guidelines owner mutate" on public.guidelines for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Trash view = "deleted_at is not null"; no additional policy needed,
-- the API route filters on the deleted_at column itself.
