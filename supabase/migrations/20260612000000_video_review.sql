-- ============================================================================
-- Loophole — Video Review (Frame.io-style)
--   Projects → folders → assets → versions, with timestamped + frame-annotated
--   comments, threaded replies, Notion-style status, public guest sharing.
--   Reuses public.set_updated_at() and the owner-RLS pattern from the init schema.
-- ============================================================================

-- ─── enums ──────────────────────────────────────────────────────────────────
create type public.review_asset_kind   as enum ('video', 'image', 'audio');
create type public.review_asset_status as enum ('uploading', 'processing', 'ready', 'errored');
create type public.comment_status      as enum ('open', 'in_progress', 'done');
create type public.annotation_type     as enum ('arrow', 'rect', 'ellipse', 'freehand', 'text');

-- ─── projects (the shareable container) ─────────────────────────────────────
create table public.review_projects (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.profiles(id) on delete cascade,
  name            text not null default 'Untitled project',
  description     text,

  -- public share link (mirrors guidelines.share_slug / password_hash)
  share_slug      text unique,
  password_hash   text,                                  -- salted sha256; null = no password
  allow_download  boolean not null default false,

  view_count      integer not null default 0,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index review_projects_owner_idx      on public.review_projects(owner_id);
create index review_projects_share_slug_idx on public.review_projects(share_slug);
create index review_projects_deleted_at_idx on public.review_projects(deleted_at);
create trigger review_projects_updated before update on public.review_projects
  for each row execute function public.set_updated_at();

-- ─── folders (nestable) ─────────────────────────────────────────────────────
create table public.review_folders (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.review_projects(id) on delete cascade,
  parent_id   uuid references public.review_folders(id) on delete cascade,
  name        text not null default 'New folder',
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);
create index review_folders_project_idx on public.review_folders(project_id);
create index review_folders_parent_idx  on public.review_folders(parent_id);

-- ─── assets (a logical media item; versions live separately) ────────────────
create table public.review_assets (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.review_projects(id) on delete cascade,
  folder_id       uuid references public.review_folders(id) on delete set null,
  kind            public.review_asset_kind not null,
  name            text not null default 'Untitled',
  current_version integer not null default 1,
  position        integer not null default 0,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index review_assets_project_idx    on public.review_assets(project_id);
create index review_assets_folder_idx     on public.review_assets(folder_id);
create index review_assets_deleted_at_idx on public.review_assets(deleted_at);
create trigger review_assets_updated before update on public.review_assets
  for each row execute function public.set_updated_at();

-- ─── asset versions (Frame.io V1/V2…) ───────────────────────────────────────
create table public.review_asset_versions (
  id              uuid primary key default gen_random_uuid(),
  asset_id        uuid not null references public.review_assets(id) on delete cascade,
  version         integer not null,
  status          public.review_asset_status not null default 'uploading',
  provider        text not null default 'mux' check (provider in ('mux','bunny','storage')),

  -- video (mux)
  mux_upload_id   text,
  mux_asset_id    text,
  mux_playback_id text,

  -- image / audio (bunny cdn or supabase storage)
  file_url        text,

  -- media metadata (filled by webhook / status poll / direct upload)
  duration_s      numeric,
  aspect_ratio    text,
  width           integer,
  height          integer,
  thumbnail_url   text,
  size_bytes      bigint,

  created_at      timestamptz not null default now(),
  unique (asset_id, version)
);
create index review_versions_asset_idx     on public.review_asset_versions(asset_id);
create index review_versions_mux_upload_idx on public.review_asset_versions(mux_upload_id);

-- ─── comments (timestamped comment OR threaded reply) ───────────────────────
create table public.review_comments (
  id                  uuid primary key default gen_random_uuid(),
  asset_id            uuid not null references public.review_assets(id) on delete cascade,
  version_id          uuid not null references public.review_asset_versions(id) on delete cascade,
  parent_id           uuid references public.review_comments(id) on delete cascade,  -- null = top-level

  -- authorship: exactly one side is set
  author_profile_id   uuid references public.profiles(id) on delete set null,        -- owner/editor
  author_guest_name   text,                                                          -- public guest
  author_guest_token  text,                                                          -- guest session token

  body                text not null default '',
  timestamp_seconds   numeric,                       -- null for general comments / replies
  status              public.comment_status not null default 'open',
  resolved_at         timestamptz,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index review_comments_version_idx on public.review_comments(version_id);
create index review_comments_asset_idx   on public.review_comments(asset_id);
create index review_comments_parent_idx  on public.review_comments(parent_id);
create index review_comments_guest_idx   on public.review_comments(author_guest_token);
create trigger review_comments_updated before update on public.review_comments
  for each row execute function public.set_updated_at();

-- ─── annotations (frame drawings, attached to a comment) ────────────────────
create table public.annotations (
  id                uuid primary key default gen_random_uuid(),
  comment_id        uuid not null references public.review_comments(id) on delete cascade,
  version_id        uuid not null references public.review_asset_versions(id) on delete cascade,
  asset_id          uuid not null references public.review_assets(id) on delete cascade,
  timestamp_seconds numeric not null,
  type              public.annotation_type not null,
  -- all coordinates are 0..1 percentages of the media box → responsive on any size
  coordinates_json  jsonb not null default '{}'::jsonb,  -- {x,y,endX,endY,points:[],w,h,text,fontSize}
  color             text not null default '#ff3b30',
  stroke_width      numeric not null default 3,
  created_at        timestamptz not null default now()
);
create index annotations_comment_idx on public.annotations(comment_id);
create index annotations_version_idx on public.annotations(version_id);

-- ============================================================================
-- ROW LEVEL SECURITY
--   Owner CRUD via project ownership joins (mirrors questions/options/responses).
--   Public guest reads/writes go exclusively through service-role API routes.
-- ============================================================================
alter table public.review_projects       enable row level security;
alter table public.review_folders        enable row level security;
alter table public.review_assets         enable row level security;
alter table public.review_asset_versions enable row level security;
alter table public.review_comments       enable row level security;
alter table public.annotations           enable row level security;

-- projects: owner reads (respecting soft delete) + full mutate
create policy "review_projects owner read" on public.review_projects for select
  using (auth.uid() = owner_id);
create policy "review_projects owner mutate" on public.review_projects for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- folders inherit ownership from project
create policy "review_folders owner all" on public.review_folders for all
  using (exists (select 1 from public.review_projects p where p.id = project_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.review_projects p where p.id = project_id and p.owner_id = auth.uid()));

-- assets inherit ownership from project
create policy "review_assets owner all" on public.review_assets for all
  using (exists (select 1 from public.review_projects p where p.id = project_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.review_projects p where p.id = project_id and p.owner_id = auth.uid()));

-- versions inherit ownership through asset → project
create policy "review_versions owner all" on public.review_asset_versions for all
  using (exists (
    select 1 from public.review_assets a
    join public.review_projects p on p.id = a.project_id
    where a.id = asset_id and p.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.review_assets a
    join public.review_projects p on p.id = a.project_id
    where a.id = asset_id and p.owner_id = auth.uid()
  ));

-- comments inherit ownership through asset → project
create policy "review_comments owner all" on public.review_comments for all
  using (exists (
    select 1 from public.review_assets a
    join public.review_projects p on p.id = a.project_id
    where a.id = asset_id and p.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.review_assets a
    join public.review_projects p on p.id = a.project_id
    where a.id = asset_id and p.owner_id = auth.uid()
  ));

-- annotations inherit ownership through asset → project
create policy "annotations owner all" on public.annotations for all
  using (exists (
    select 1 from public.review_assets a
    join public.review_projects p on p.id = a.project_id
    where a.id = asset_id and p.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.review_assets a
    join public.review_projects p on p.id = a.project_id
    where a.id = asset_id and p.owner_id = auth.uid()
  ));

-- ─── public view counter (bumped from the public /r/[slug] page) ────────────
create or replace function public.increment_review_views(p_slug text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.review_projects
     set view_count = view_count + 1
   where share_slug = p_slug
     and deleted_at is null;
$$;
grant execute on function public.increment_review_views(text) to anon, authenticated;

-- ─── 30-day auto-purge of trashed reviews (extends purge_trash) ─────────────
create or replace function public.purge_trash()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.guidelines      where deleted_at is not null and deleted_at < now() - interval '30 days';
  delete from public.responses       where deleted_at is not null and deleted_at < now() - interval '30 days';
  delete from public.review_projects where deleted_at is not null and deleted_at < now() - interval '30 days';
  delete from public.review_assets   where deleted_at is not null and deleted_at < now() - interval '30 days';
end $$;

-- ============================================================================
-- STORAGE: private bucket for image/audio (video always goes to Mux)
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('review-media', 'review-media', false)
on conflict (id) do nothing;
