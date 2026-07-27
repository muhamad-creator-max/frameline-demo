-- ============================================================================
-- Loophole — Workflow Responses (Phase 2)
--   Client answers collected by the public /w/[slug] branching flow. One
--   response per client run; one answer row per node they reached. Mirrors the
--   guidelines responses/answers model and owner-RLS pattern.
-- ============================================================================

create type public.workflow_response_status as enum ('in_progress', 'submitted');

-- ─── responses (one per client run of a published workflow) ─────────────────
create table public.workflow_responses (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.workflow_projects(id) on delete cascade,
  snapshot_id   uuid not null references public.workflow_snapshots(id) on delete cascade,

  client_name   text not null,
  client_email  citext,              -- optional, for future re-contact
  user_agent    text,
  ip_hash       text,                -- hashed at the API layer for privacy

  -- Ordered list of node ids the client actually visited (the branch they took).
  path          jsonb not null default '[]'::jsonb,

  status        public.workflow_response_status not null default 'in_progress',
  started_at    timestamptz not null default now(),
  submitted_at  timestamptz,
  duration_ms   integer,
  deleted_at    timestamptz
);
create index workflow_responses_project_idx on public.workflow_responses(project_id);
create index workflow_responses_status_idx  on public.workflow_responses(status);
create index workflow_responses_deleted_idx on public.workflow_responses(deleted_at);

-- ─── answers (one per node the client answered) ─────────────────────────────
create table public.workflow_answers (
  id            uuid primary key default gen_random_uuid(),
  response_id   uuid not null references public.workflow_responses(id) on delete cascade,
  node_id       uuid not null,     -- references a node id inside the snapshot
  kind          public.workflow_node_kind not null,

  -- One shape is populated depending on kind (kept in jsonb for flexibility):
  --   question → {text, link, files:[{name,url,kind,size}]}
  --   choice   → {selected:[choiceId,...]}
  --   identity → {selected:[boxId,...]}
  --   note     → {}  (acknowledged only)
  value         jsonb not null default '{}'::jsonb,

  -- Optional free-note the client added (question composer text lives in value.text).
  comment_text  text,

  created_at    timestamptz not null default now(),
  unique (response_id, node_id)
);
create index workflow_answers_response_idx on public.workflow_answers(response_id);

-- ============================================================================
-- ROW LEVEL SECURITY
--   Owner reads via project ownership; public inserts/updates go through
--   service-role API routes that validate the share slug + password.
-- ============================================================================
alter table public.workflow_responses enable row level security;
alter table public.workflow_answers   enable row level security;

create policy "workflow_responses owner read" on public.workflow_responses for select
  using (exists (select 1 from public.workflow_projects p where p.id = project_id and p.owner_id = auth.uid()));

-- Owner may soft-delete / restore their responses.
create policy "workflow_responses owner mutate" on public.workflow_responses for update
  using (exists (select 1 from public.workflow_projects p where p.id = project_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.workflow_projects p where p.id = project_id and p.owner_id = auth.uid()));

create policy "workflow_answers owner read" on public.workflow_answers for select
  using (exists (
    select 1 from public.workflow_responses r
    join public.workflow_projects p on p.id = r.project_id
    where r.id = response_id and p.owner_id = auth.uid()
  ));

-- ─── extend the 30-day auto-purge to include trashed workflow responses ─────
create or replace function public.purge_trash()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.guidelines         where deleted_at is not null and deleted_at < now() - interval '30 days';
  delete from public.responses          where deleted_at is not null and deleted_at < now() - interval '30 days';
  delete from public.review_projects    where deleted_at is not null and deleted_at < now() - interval '30 days';
  delete from public.review_assets      where deleted_at is not null and deleted_at < now() - interval '30 days';
  delete from public.workflow_projects  where deleted_at is not null and deleted_at < now() - interval '30 days';
  delete from public.workflow_responses where deleted_at is not null and deleted_at < now() - interval '30 days';
end $$;
