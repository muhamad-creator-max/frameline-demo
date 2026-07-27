-- ============================================================================
-- Loophole — Workflows (visual node-graph brief builder)
--   A canvas of question "nodes" (Question / Choice / Identity / Note) wired
--   together with edges for conditional branching ("if answer X → node Y").
--   Mirrors the guidelines draft+snapshot+response model and the owner-RLS
--   pattern from the init + video_review schemas. Reuses public.set_updated_at().
--
--   Phase 1 ships the editor (projects/nodes/edges + snapshots table).
--   Public branching flow + responses/answers land in Phase 2 (tables here
--   are created now so publishing plumbing is ready).
-- ============================================================================

-- ─── enums ──────────────────────────────────────────────────────────────────
-- 'start' is the single entry node the public flow begins from.
create type public.workflow_node_kind as enum ('start', 'question', 'choice', 'identity', 'note');
create type public.workflow_status    as enum ('draft', 'published', 'archived');

-- ─── projects (the shareable canvas container) ──────────────────────────────
create table public.workflow_projects (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.profiles(id) on delete cascade,
  title           text not null default 'Untitled workflow',
  description     text,

  -- public share link (mirrors guidelines.share_slug / password_hash)
  share_slug      text unique,
  password_hash   text,                                  -- salted sha256; null = no password

  -- persisted canvas viewport {x, y, zoom} so the editor reopens where you left it
  canvas          jsonb not null default '{"x":0,"y":0,"zoom":1}'::jsonb,

  status          public.workflow_status not null default 'draft',

  -- versioning: 0 = "no snapshot yet"; first publish writes v1 (mirrors guidelines)
  current_version integer not null default 0,

  view_count      integer not null default 0,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index workflow_projects_owner_idx      on public.workflow_projects(owner_id);
create index workflow_projects_share_slug_idx on public.workflow_projects(share_slug);
create index workflow_projects_deleted_at_idx on public.workflow_projects(deleted_at);
create trigger workflow_projects_updated before update on public.workflow_projects
  for each row execute function public.set_updated_at();

-- ─── nodes (positioned cards on the canvas) ─────────────────────────────────
create table public.workflow_nodes (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.workflow_projects(id) on delete cascade,
  kind          public.workflow_node_kind not null,

  -- canvas geometry (world coordinates, not screen)
  x             double precision not null default 0,
  y             double precision not null default 0,
  w             double precision not null default 300,
  h             double precision not null default 180,

  -- per-kind config. Shape depends on kind (see src/lib/workflow/store.ts):
  --   question → {title, helper, answer:{text,image,video,link,file}}
  --   choice   → {title, helper, max_answers, choices:[{id,label,media_*}]}
  --   identity → {title, max_answers, boxes:[{id,bg,text,font,lang,color,textBg,
  --                shadow,radius}]}
  --   note     → {text}
  --   start    → {label}
  -- Editor Hand-off (cells + attachments) lives under data.settings / data.attachments.
  data          jsonb not null default '{}'::jsonb,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index workflow_nodes_project_idx on public.workflow_nodes(project_id);
create trigger workflow_nodes_updated before update on public.workflow_nodes
  for each row execute function public.set_updated_at();

-- ─── edges (connections / branching) ────────────────────────────────────────
-- source_port identifies which output the edge leaves from:
--   question → 'out' (single "answered" port)
--   choice   → the choice id (per-answer branching)
--   identity → the box id
--   start    → 'out'
-- target_port is reserved for future multi-input nodes; today every node has
-- one input, so it defaults to 'in'.
create table public.workflow_edges (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.workflow_projects(id) on delete cascade,
  source_node_id uuid not null references public.workflow_nodes(id) on delete cascade,
  source_port    text not null default 'out',
  target_node_id uuid not null references public.workflow_nodes(id) on delete cascade,
  target_port    text not null default 'in',
  label          text,
  created_at     timestamptz not null default now(),
  -- exactly one edge per (source, port) keeps branching deterministic
  unique (source_node_id, source_port)
);
create index workflow_edges_project_idx on public.workflow_edges(project_id);
create index workflow_edges_source_idx  on public.workflow_edges(source_node_id);
create index workflow_edges_target_idx  on public.workflow_edges(target_node_id);

-- ─── snapshots (frozen graph at publish, used by the public flow in Phase 2) ─
create table public.workflow_snapshots (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.workflow_projects(id) on delete cascade,
  version       integer not null,
  payload       jsonb not null,        -- full {title, canvas, nodes[], edges[]}
  created_at    timestamptz not null default now(),
  unique (project_id, version)
);
create index workflow_snapshots_project_idx on public.workflow_snapshots(project_id);

-- ============================================================================
-- ROW LEVEL SECURITY
--   Owner CRUD via project-ownership joins (mirrors questions/options/review_*).
--   Public guest reads (Phase 2) will go through service-role API routes.
-- ============================================================================
alter table public.workflow_projects  enable row level security;
alter table public.workflow_nodes     enable row level security;
alter table public.workflow_edges     enable row level security;
alter table public.workflow_snapshots enable row level security;

-- projects: owner reads (respecting soft delete) + full mutate
create policy "workflow_projects owner read" on public.workflow_projects for select
  using (auth.uid() = owner_id);
create policy "workflow_projects owner mutate" on public.workflow_projects for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- nodes inherit ownership from project
create policy "workflow_nodes owner all" on public.workflow_nodes for all
  using (exists (select 1 from public.workflow_projects p where p.id = project_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.workflow_projects p where p.id = project_id and p.owner_id = auth.uid()));

-- edges inherit ownership from project
create policy "workflow_edges owner all" on public.workflow_edges for all
  using (exists (select 1 from public.workflow_projects p where p.id = project_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.workflow_projects p where p.id = project_id and p.owner_id = auth.uid()));

-- snapshots: owner reads; service role writes (publishing happens server-side)
create policy "workflow_snapshots owner read" on public.workflow_snapshots for select
  using (exists (select 1 from public.workflow_projects p where p.id = project_id and p.owner_id = auth.uid()));

-- ─── public view counter (bumped from the public /w/[slug] page in Phase 2) ─
create or replace function public.increment_workflow_views(p_slug text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.workflow_projects
     set view_count = view_count + 1
   where share_slug = p_slug
     and deleted_at is null;
$$;
grant execute on function public.increment_workflow_views(text) to anon, authenticated;

-- ─── extend the 30-day auto-purge to include trashed workflows ──────────────
create or replace function public.purge_trash()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.guidelines        where deleted_at is not null and deleted_at < now() - interval '30 days';
  delete from public.responses         where deleted_at is not null and deleted_at < now() - interval '30 days';
  delete from public.review_projects   where deleted_at is not null and deleted_at < now() - interval '30 days';
  delete from public.review_assets     where deleted_at is not null and deleted_at < now() - interval '30 days';
  delete from public.workflow_projects where deleted_at is not null and deleted_at < now() - interval '30 days';
end $$;
