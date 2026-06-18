import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readGuestSession, resolveSharedProject } from "@/lib/review/guest";
import { buildCommentTree, insertCommentWithAnnotation } from "@/lib/review/server";
import type { CreateCommentInput } from "@/lib/review/types";

export const runtime = "nodejs";

/** Confirm a version belongs to the project behind this share slug. */
async function versionInProject(versionId: string, projectId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("review_asset_versions")
    .select("id, asset:review_assets!inner(project_id, deleted_at)")
    .eq("id", versionId)
    .maybeSingle();
  const asset = (data as { asset: { project_id: string; deleted_at: string | null } | null } | null)?.asset;
  return !!asset && asset.project_id === projectId && !asset.deleted_at;
}

/** GET /api/review/r/[slug]/comments?versionId= — list comments + annotations. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const versionId = new URL(req.url).searchParams.get("versionId");
  if (!versionId) return NextResponse.json({ error: "versionId required" }, { status: 400 });

  const project = await resolveSharedProject(slug);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!(await versionInProject(versionId, project.id))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const admin = createAdminClient();
  const [{ data: comments }, { data: annotations }] = await Promise.all([
    admin.from("review_comments").select("*").eq("version_id", versionId),
    admin.from("annotations").select("*").eq("version_id", versionId),
  ]);

  const tree = buildCommentTree(comments ?? [], annotations ?? []);
  // Tell the guest which comments are theirs (so the UI can offer edit/delete).
  const session = await readGuestSession(slug);
  return NextResponse.json({ comments: tree, guestToken: session?.token ?? null });
}

/** POST /api/review/r/[slug]/comments — guest creates a comment (+ optional annotation). */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = await resolveSharedProject(slug);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

  const session = await readGuestSession(slug);
  if (!session) return NextResponse.json({ error: "identify first" }, { status: 401 });

  const body = (await req.json()) as CreateCommentInput;
  if (!body.versionId) return NextResponse.json({ error: "versionId required" }, { status: 400 });
  const annotations = body.annotations ?? [];
  if (!body.body?.trim() && annotations.length === 0) {
    return NextResponse.json({ error: "empty comment" }, { status: 400 });
  }
  if (!(await versionInProject(body.versionId, project.id))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const admin = createAdminClient();
  const result = await insertCommentWithAnnotation(
    admin,
    {
      version_id: body.versionId,
      parent_id: body.parentId ?? null,
      author_guest_name: session.name,
      author_guest_token: session.token,
      body: body.body?.trim() ?? "",
      timestamp_seconds: body.timestampSeconds,
    },
    annotations,
  );

  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ id: result.id });
}
