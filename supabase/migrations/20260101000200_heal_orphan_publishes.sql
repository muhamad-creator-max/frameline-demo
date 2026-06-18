-- Heal "published" guidelines that have no matching snapshot row
-- (caused by an earlier publish where the snapshot insert was blocked by RLS).
-- Reset them to draft + current_version 0 so the editor must re-publish,
-- which will now succeed via the service-role path.
update public.guidelines g
   set status = 'draft',
       current_version = 0
 where g.status = 'published'
   and not exists (
     select 1 from public.guideline_snapshots s
      where s.guideline_id = g.id
        and s.version = g.current_version
   );

-- Allow snapshot inserts by the guideline owner too (belt-and-braces;
-- the API uses service role, but this makes intent explicit).
drop policy if exists "snapshots owner insert" on public.guideline_snapshots;
create policy "snapshots owner insert" on public.guideline_snapshots for insert
  with check (exists (
    select 1 from public.guidelines g
    where g.id = guideline_id and g.owner_id = auth.uid()
  ));
