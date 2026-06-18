import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { insertCommentWithAnnotation } from "@/lib/review/server";
import type { CreateCommentInput } from "@/lib/review/types";

export const runtime = "nodejs";

/**
 * POST /api/review/comments
 * Owner-authored comment (or reply), optionally carrying a freshly-drawn
 * annotation. The comment + annotation are written together.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as CreateCommentInput;
  if (!body.versionId) return NextResponse.json({ error: "versionId required" }, { status: 400 });
  const annotations = body.annotations ?? [];
  if (!body.body?.trim() && annotations.length === 0) {
    return NextResponse.json({ error: "empty comment" }, { status: 400 });
  }

  // Owner display name for the comment.
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle();
  const name = profile?.full_name ?? profile?.email ?? "You";

  const result = await insertCommentWithAnnotation(
    supabase,
    {
      version_id: body.versionId,
      parent_id: body.parentId ?? null,
      author_profile_id: user.id,
      author_guest_name: name,
      body: body.body?.trim() ?? "",
      timestamp_seconds: body.timestampSeconds,
    },
    annotations,
  );

  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ id: result.id });
}
