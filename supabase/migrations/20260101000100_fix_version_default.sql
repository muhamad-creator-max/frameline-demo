-- Fix: current_version should start at 0 (no snapshot yet). First publish → v1.
alter table public.guidelines alter column current_version set default 0;

-- Reset any existing drafts that never got a snapshot back to 0 so the next
-- publish writes v1 and the client flow stops failing with "not published".
update public.guidelines g
   set current_version = 0
 where g.status <> 'published'
   and not exists (
     select 1 from public.guideline_snapshots s
      where s.guideline_id = g.id
   );
