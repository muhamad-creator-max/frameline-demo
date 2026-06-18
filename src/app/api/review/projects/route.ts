import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { newShareSlug } from "@/lib/utils";

export const runtime = "nodejs";

/**
 * POST /api/review/projects → { id }
 * Creates a new review project owned by the current user, with a share slug
 * pre-minted (sharing is enabled by default; password is opt-in).
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { name } = await req.json().catch(() => ({}));

  const { data, error } = await supabase
    .from("review_projects")
    .insert({
      owner_id: user.id,
      name: name?.trim() || "Untitled project",
      share_slug: newShareSlug(),
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
