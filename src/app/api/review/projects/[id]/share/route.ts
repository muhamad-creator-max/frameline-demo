import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { newShareSlug } from "@/lib/utils";

export const runtime = "nodejs";

/**
 * POST /api/review/projects/[id]/share → { shareSlug }
 * Ensures the project has a share slug (mints one if missing). Idempotent.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: project } = await supabase
    .from("review_projects")
    .select("id, share_slug")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

  let shareSlug = project.share_slug;
  if (!shareSlug) {
    shareSlug = newShareSlug();
    const { error } = await supabase
      .from("review_projects")
      .update({ share_slug: shareSlug })
      .eq("id", id)
      .eq("owner_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ shareSlug });
}
