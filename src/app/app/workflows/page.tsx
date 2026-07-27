import { createClient } from "@/lib/supabase/server";
import { WorkflowsPageClient } from "@/components/workflow/workflows-page-client";
import type { WorkflowNodeKind } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 12;

export default async function WorkflowsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: projects, count } = await supabase
    .from("workflow_projects")
    .select("id, title, description, status, view_count, updated_at, share_slug, current_version, workflow_nodes(id, kind, x, y), workflow_edges(source_node_id, target_node_id)", { count: "exact" })
    .eq("owner_id", user!.id)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .range(from, to);

  const rows = (projects ?? []).map((p) => {
    const nodes = (Array.isArray(p.workflow_nodes) ? p.workflow_nodes : []) as Array<{
      id: string; kind: WorkflowNodeKind; x: number; y: number;
    }>;
    const edges = (Array.isArray(p.workflow_edges) ? p.workflow_edges : []) as Array<{
      source_node_id: string; target_node_id: string;
    }>;
    return {
      id: p.id,
      title: p.title,
      description: p.description ?? "",
      status: p.status as "draft" | "published" | "archived",
      share_slug: p.share_slug ?? "",
      current_version: p.current_version ?? 0,
      view_count: p.view_count ?? 0,
      updated_at: p.updated_at,
      // A Start node is seeded on create; subtract it so the count reflects real questions.
      node_count: Math.max(0, nodes.length - 1),
      // Geometry for the card's canvas thumbnail.
      thumb: {
        nodes: nodes.map((n) => ({ id: n.id, kind: n.kind, x: n.x, y: n.y })),
        edges: edges.map((e) => ({ from: e.source_node_id, to: e.target_node_id })),
      },
    };
  });

  return <WorkflowsPageClient rows={rows} page={page} pageSize={PAGE_SIZE} total={count ?? 0} />;
}
