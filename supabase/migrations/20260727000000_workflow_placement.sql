-- Placement node type for workflows.
--
-- A Placement node shows a base image/video with text + image overlays composited
-- on top (caption / logo mock-ups), then collects one response from the client.
-- Its whole payload lives in workflow_nodes.data->'placement' (jsonb):
--
--   { media:  { url, kind:'image'|'video', name, width, height, provider } | null,
--     aspect: number,                       -- stage width / height
--     layers: [ { id, type:'text', x, y, rotation, text, font, lang, weight,
--                 size, color, shadow:{on,x,y,blur,color}, bg:{on,color,radius} }
--             | { id, type:'image', x, y, rotation, url, name, scale, blend,
--                 opacity } ],
--     respond: 'text' | 'media' | 'link' }
--
-- All layer geometry is relative (percent), never px — see src/lib/workflow/placement.ts.
-- Only the node-kind enum needs a schema change; the answer shape reuses the
-- question one ({text, link, files}).

alter type public.workflow_node_kind add value if not exists 'placement';
