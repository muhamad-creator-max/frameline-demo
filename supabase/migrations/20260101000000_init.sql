-- ============================================================================
-- Loophole — Visual Creative Alignment Platform
-- Initial schema: profiles, guidelines (draft + snapshot), questions, options,
--                 editor "settings cells", responses, plan/subscription.
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ─── helpers ────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ─── enums ──────────────────────────────────────────────────────────────────
create type public.question_kind        as enum ('choice', 'like', 'answer');
create type public.media_kind           as enum ('image', 'gif', 'video', 'text');
create type public.guideline_status     as enum ('draft', 'published', 'archived');
create type public.response_status      as enum ('in_progress', 'submitted');
create type public.plan_tier            as enum ('free', 'pro', 'studio');
create type public.subscription_status  as enum ('trialing','active','canceled','past_due','incomplete','incomplete_expired','unpaid','paused');

-- ─── profiles (1:1 auth.users) ──────────────────────────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       citext unique not null,
  full_name   text,
  avatar_url  text,
  locale      text default 'en' check (locale in ('en','ar')),
  plan        public.plan_tier not null default 'free',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create profile row after signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── guidelines ─────────────────────────────────────────────────────────────
create table public.guidelines (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.profiles(id) on delete cascade,
  title           text not null default 'Untitled brief',
  description     text,
  cover_color     text default '#00BE43',
  status          public.guideline_status not null default 'draft',

  -- public share link
  share_slug      text unique,
  password_hash   text,                          -- bcrypt-style; null = no password
  one_question_per_screen boolean not null default true,

  -- versioning: incremented every time editor publishes a new snapshot.
  -- starts at 0 — meaning "no snapshot yet". first publish writes v1.
  current_version integer not null default 0,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index guidelines_owner_idx on public.guidelines(owner_id);
create index guidelines_share_slug_idx on public.guidelines(share_slug);
create trigger guidelines_updated before update on public.guidelines
  for each row execute function public.set_updated_at();

-- ─── questions (live/draft) ─────────────────────────────────────────────────
create table public.questions (
  id            uuid primary key default gen_random_uuid(),
  guideline_id  uuid not null references public.guidelines(id) on delete cascade,
  position      integer not null,
  kind          public.question_kind not null,
  title         text not null,
  helper        text,
  required      boolean not null default false,
  -- enables the AI-prompt-style comment box on this question
  allow_comment boolean not null default true,
  -- question-level editor settings (key/value rows). option-level lives on options table.
  settings      jsonb not null default '[]'::jsonb,  -- [{label, value}]
  attachments   jsonb not null default '[]'::jsonb,  -- [{name, url, kind, size}]
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (guideline_id, position)
);
create index questions_guideline_idx on public.questions(guideline_id);
create trigger questions_updated before update on public.questions
  for each row execute function public.set_updated_at();

-- ─── options (for choice/like questions) ────────────────────────────────────
create table public.options (
  id            uuid primary key default gen_random_uuid(),
  question_id   uuid not null references public.questions(id) on delete cascade,
  position      integer not null,
  label         text,
  media_kind    public.media_kind not null default 'text',
  media_url     text,        -- bunny cdn url or mux playback id (see media_provider)
  media_provider text check (media_provider in ('bunny','mux','external')) default 'bunny',
  media_meta    jsonb not null default '{}'::jsonb,  -- {width, height, duration_s, poster, ...}
  -- option-level editor settings (override question-level)
  settings      jsonb not null default '[]'::jsonb,
  attachments   jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now(),
  unique (question_id, position)
);
create index options_question_idx on public.options(question_id);

-- ─── snapshots (frozen guideline at moment of publish/send) ─────────────────
-- When the editor "publishes" a guideline, we snapshot a full JSON copy so
-- in-flight client responses are stable even if the editor edits afterwards.
create table public.guideline_snapshots (
  id            uuid primary key default gen_random_uuid(),
  guideline_id  uuid not null references public.guidelines(id) on delete cascade,
  version       integer not null,
  payload       jsonb not null,        -- full {title, questions, options, settings...}
  created_at    timestamptz not null default now(),
  unique (guideline_id, version)
);

-- ─── responses (from clients) ───────────────────────────────────────────────
create table public.responses (
  id            uuid primary key default gen_random_uuid(),
  guideline_id  uuid not null references public.guidelines(id) on delete cascade,
  snapshot_id   uuid not null references public.guideline_snapshots(id) on delete cascade,

  client_name   text not null,
  client_email  citext,            -- optional, for future re-contact
  user_agent    text,
  ip_hash       text,              -- hashed at API layer for privacy

  status        public.response_status not null default 'in_progress',
  started_at    timestamptz not null default now(),
  submitted_at  timestamptz,
  duration_ms   integer
);
create index responses_guideline_idx on public.responses(guideline_id);
create index responses_status_idx    on public.responses(status);

-- ─── answers ────────────────────────────────────────────────────────────────
create table public.answers (
  id            uuid primary key default gen_random_uuid(),
  response_id   uuid not null references public.responses(id) on delete cascade,
  question_id   uuid not null,    -- references questions(id) at snapshot time

  -- One of these will be populated depending on question.kind:
  selected_option_ids uuid[],     -- choice
  liked         boolean,          -- like (null = skipped)
  text_value    text,             -- answer

  -- The AI-prompt-style comment box (every question type can have one)
  comment_text  text,
  comment_attachments jsonb not null default '[]'::jsonb,

  created_at    timestamptz not null default now(),
  unique (response_id, question_id)
);
create index answers_response_idx on public.answers(response_id);

-- ─── billing / subscriptions ────────────────────────────────────────────────
create table public.subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null unique references public.profiles(id) on delete cascade,
  stripe_customer_id       text unique,
  stripe_subscription_id   text unique,
  stripe_price_id          text,
  plan                     public.plan_tier not null default 'free',
  status                   public.subscription_status not null default 'active',
  current_period_end       timestamptz,
  cancel_at_period_end     boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create trigger subscriptions_updated before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ─── webhook log (idempotency for Stripe + Mux) ─────────────────────────────
create table public.webhook_events (
  id          text primary key,           -- event id from provider
  provider    text not null,              -- 'stripe' | 'mux'
  type        text not null,
  payload     jsonb not null,
  processed_at timestamptz not null default now()
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.profiles            enable row level security;
alter table public.guidelines          enable row level security;
alter table public.questions           enable row level security;
alter table public.options             enable row level security;
alter table public.guideline_snapshots enable row level security;
alter table public.responses           enable row level security;
alter table public.answers             enable row level security;
alter table public.subscriptions       enable row level security;

-- profiles: owner only
create policy "profiles self read"   on public.profiles for select using (auth.uid() = id);
create policy "profiles self update" on public.profiles for update using (auth.uid() = id);

-- guidelines: owner full CRUD
create policy "guidelines owner all" on public.guidelines for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- questions / options inherit owner from guideline
create policy "questions owner all" on public.questions for all
  using (exists (select 1 from public.guidelines g where g.id = guideline_id and g.owner_id = auth.uid()))
  with check (exists (select 1 from public.guidelines g where g.id = guideline_id and g.owner_id = auth.uid()));

create policy "options owner all" on public.options for all
  using (exists (
    select 1 from public.questions q
    join public.guidelines g on g.id = q.guideline_id
    where q.id = question_id and g.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.questions q
    join public.guidelines g on g.id = q.guideline_id
    where q.id = question_id and g.owner_id = auth.uid()
  ));

-- snapshots: owner reads, service role writes (publishing happens server-side)
create policy "snapshots owner read" on public.guideline_snapshots for select
  using (exists (select 1 from public.guidelines g where g.id = guideline_id and g.owner_id = auth.uid()));

-- responses & answers: owner reads via guideline; inserts/updates from client flow
-- go through service-role API routes that validate the share slug + password.
create policy "responses owner read" on public.responses for select
  using (exists (select 1 from public.guidelines g where g.id = guideline_id and g.owner_id = auth.uid()));

create policy "answers owner read" on public.answers for select
  using (exists (
    select 1 from public.responses r
    join public.guidelines g on g.id = r.guideline_id
    where r.id = response_id and g.owner_id = auth.uid()
  ));

-- subscriptions: read only by owner; mutations from Stripe webhooks (service role)
create policy "subs self read" on public.subscriptions for select using (auth.uid() = user_id);

-- ============================================================================
-- STORAGE BUCKETS (Supabase storage is fallback; primary media goes to Mux/Bunny)
-- ============================================================================
insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('guideline-media', 'guideline-media', false)
on conflict (id) do nothing;

create policy "avatars public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars owner write"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
