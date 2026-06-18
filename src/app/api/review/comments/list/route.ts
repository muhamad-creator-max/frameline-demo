import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildCommentTree } from "@/lib/review/server";

export const runtime = "nodejs";

/**
 * GET /api/review/comments/list?versionId=
 * Owner-authed comment + annotation listing for a version. RLS ensures the
 * caller can only read versions inside their own projects.
 */
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const versionId = new URL(req.url).searchParams.get("versionId");
  if (!versionId) return NextResponse.json({ error: "versionId required" }, { status: 400 });

  const [{ data: comments }, { data: annotations }] = await Promise.all([
    supabase.from("review_comments").select("*").eq("version_id", versionId),
    supabase.from("annotations").select("*").eq("version_id", versionId),
  ]);

  const tree = buildCommentTree(comments ?? [], annotations ?? []);
  return NextResponse.json({ comments: tree, guestToken: null });
}
