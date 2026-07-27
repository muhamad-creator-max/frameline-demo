import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { newShareSlug } from "@/lib/utils";
import type { WorkflowNodeKind, WorkflowNodeData, WorkflowCanvasState } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

/**
 * Duplicate a workflow (nodes + edges + canvas). Node IDs are remapped so edge
 * endpoints stay valid. Snapshots are NOT copied — the copy starts as a draft.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const { data: source } = await supabase
    .from("workflow_projects")
    .select("*")
    .eq("id", id)
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!source) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Fetch children separately — the hand-maintained types don't declare FK
  // relationships, so nested selects don't type-check.
  const [{ data: srcNodes }, { data: srcEdges }] = await Promise.all([
    supabase.from("workflow_nodes").select("*").eq("project_id", id),
    supabase.from("workflow_edges").select("*").eq("project_id", id),
  ]);

  const { data: copy, error } = await admin
    .from("workflow_projects")
    .insert({
      owner_id: user.id,
      title: `${source.title} (copy)`,
      description: source.description,
      canvas: source.canvas as WorkflowCanvasState,
      status: "draft",
      share_slug: newShareSlug(),
      current_version: 0,
    })
    .select("id")
    .single();
  if (error || !copy) return NextResponse.json({ error: error?.message ?? "copy failed" }, { status: 500 });

  // Remap node ids old → new.
  const nodes = (srcNodes as Array<{
    id: string; kind: WorkflowNodeKind; x: number; y: number; w: number; h: number; data: WorkflowNodeData;
  }> | null) ?? [];
  const idMap = new Map<string, string>();
  for (const n of nodes) idMap.set(n.id, crypto.randomUUID());

  if (nodes.length) {
    const { error: nErr } = await admin.from("workflow_nodes").insert(
      nodes.map((n) => ({
        id: idMap.get(n.id)!,
        project_id: copy.id,
        kind: n.kind,
        x: n.x,
        y: n.y,
        w: n.w,
        h: n.h,
        data: n.data,
      })),
    );
    if (nErr) return NextResponse.json({ error: nErr.message }, { status: 500 });
  }

  const edges = (srcEdges as Array<{
    source_node_id: string; source_port: string; target_node_id: string; target_port: string; label: string | null;
  }> | null) ?? [];
  const edgeRows = edges
    .map((e) => ({
      project_id: copy.id,
      source_node_id: idMap.get(e.source_node_id),
      source_port: e.source_port,
      target_node_id: idMap.get(e.target_node_id),
      target_port: e.target_port,
      label: e.label,
    }))
    .filter((e) => e.source_node_id && e.target_node_id) as Array<{
      project_id: string; source_node_id: string; source_port: string; target_node_id: string; target_port: string; label: string | null;
    }>;
  if (edgeRows.length) {
    const { error: eErr } = await admin.from("workflow_edges").insert(edgeRows);
    if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 });
  }

  return NextResponse.json({ id: copy.id });
}
