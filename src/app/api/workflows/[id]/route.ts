import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  WorkflowNodeKind,
  WorkflowNodeData,
  WorkflowCanvasState,
  WorkflowSnapshotPayload,
} from "@/lib/supabase/database.types";

export const runtime = "nodejs";

interface IncomingNode {
  id: string;
  kind: WorkflowNodeKind;
  x: number;
  y: number;
  w: number;
  h: number;
  data: WorkflowNodeData;
}
interface IncomingEdge {
  id: string;
  source_node_id: string;
  source_port: string;
  target_node_id: string;
  target_port: string;
  label: string | null;
}

/**
 * PATCH /api/workflows/:id
 *   Body: { project:{title,description}, canvas, nodes[], edges[], publish? }
 *
 * Reconciles nodes (upsert incoming + delete removed) and replaces the edge set
 * wholesale (edges are cheap and fully derived from the graph, and the
 * (source,port) unique constraint makes wholesale-replace the simplest correct
 * strategy). On publish=true, writes a workflow_snapshots row + bumps version.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    project: Partial<{ title: string; description: string | null }>;
    canvas: WorkflowCanvasState;
    nodes: IncomingNode[];
    edges: IncomingEdge[];
    publish?: boolean;
  };

  // ownership check
  const { data: existing } = await supabase
    .from("workflow_projects")
    .select("id, current_version, title, description")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Writes go through the admin client after the ownership check above — same
  // reasoning as the guidelines save route (avoids RLS jsonb-check edge cases).
  const admin = createAdminClient();

  // 1. Project meta + canvas
  const meta: Record<string, unknown> = {
    ...body.project,
    canvas: body.canvas,
    updated_at: new Date().toISOString(),
  };
  if (body.publish) meta.status = "published";
  {
    // Cast at the boundary — the hand-maintained types reject the dynamic meta
    // object (same `as never` idiom used across the guidelines save route).
    const { error } = await admin.from("workflow_projects").update(meta as never).eq("id", id);
    if (error) {
      console.error("[wf save] meta", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // 2. Reconcile nodes
  const incomingNodeIds = body.nodes.map((n) => n.id);
  const { data: dbNodes } = await admin.from("workflow_nodes").select("id").eq("project_id", id);
  const toDelete = (dbNodes ?? []).filter((n) => !incomingNodeIds.includes(n.id)).map((n) => n.id);
  if (toDelete.length) {
    // Deleting a node cascades its edges via FK; we replace edges below anyway.
    const { error } = await admin.from("workflow_nodes").delete().in("id", toDelete);
    if (error) console.error("[wf save] node delete", error);
  }

  for (const n of body.nodes) {
    const { error } = await admin.from("workflow_nodes").upsert({
      id: n.id,
      project_id: id,
      kind: n.kind,
      x: n.x,
      y: n.y,
      w: n.w,
      h: n.h,
      data: n.data,
    });
    if (error) {
      console.error("[wf save] node upsert", { id: n.id, error });
      return NextResponse.json({ error: `Node save failed: ${error.message}` }, { status: 500 });
    }
  }

  // 3. Replace edges wholesale (only those whose endpoints still exist).
  {
    const { error: delErr } = await admin.from("workflow_edges").delete().eq("project_id", id);
    if (delErr) console.error("[wf save] edge clear", delErr);

    const validNodeIds = new Set(incomingNodeIds);
    const edgeRows = body.edges
      .filter((e) => validNodeIds.has(e.source_node_id) && validNodeIds.has(e.target_node_id))
      .map((e) => ({
        id: e.id,
        project_id: id,
        source_node_id: e.source_node_id,
        source_port: e.source_port,
        target_node_id: e.target_node_id,
        target_port: e.target_port,
        label: e.label,
      }));
    if (edgeRows.length) {
      const { error: insErr } = await admin.from("workflow_edges").insert(edgeRows);
      if (insErr) {
        console.error("[wf save] edge insert", insErr);
        return NextResponse.json({ error: `Edge save failed: ${insErr.message}` }, { status: 500 });
      }
    }
  }

  // 4. Publish → snapshot + version bump
  if (body.publish) {
    const nextVersion = (existing.current_version ?? 0) + 1;
    const payload: WorkflowSnapshotPayload = {
      title: body.project.title ?? existing.title,
      description: body.project.description ?? existing.description ?? null,
      canvas: body.canvas,
      nodes: body.nodes.map((n) => ({
        id: n.id,
        kind: n.kind,
        x: n.x,
        y: n.y,
        w: n.w,
        h: n.h,
        data: n.data,
      })),
      edges: body.edges.map((e) => ({
        id: e.id,
        source_node_id: e.source_node_id,
        source_port: e.source_port,
        target_node_id: e.target_node_id,
        target_port: e.target_port,
        label: e.label,
      })),
    };
    const { error: snapErr } = await admin.from("workflow_snapshots").insert({
      project_id: id,
      version: nextVersion,
      payload,
    });
    if (snapErr) {
      console.error("[wf save] snapshot", snapErr);
      return NextResponse.json({ error: snapErr.message }, { status: 500 });
    }
    await admin.from("workflow_projects").update({ current_version: nextVersion }).eq("id", id);
    return NextResponse.json({ ok: true, version: nextVersion });
  }

  return NextResponse.json({ ok: true });
}
