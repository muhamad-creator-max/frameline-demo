-- ============================================================================
-- "Ready to go" guideline mode:
--   A guideline a content creator writes for their own editor — no client
--   selection step. Options become read-only reference content, the editor
--   handoff is shown inline to the viewer, and the public flow skips the
--   name gate / comments entirely (view-only reference doc).
-- ============================================================================

alter table public.guidelines
  add column if not exists ready_to_go boolean not null default false;
