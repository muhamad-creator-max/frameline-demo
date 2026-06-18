import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createDirectUpload } from "@/lib/mux/client";

export const runtime = "nodejs";

/**
 * POST /api/uploads/mux  →  { uploadUrl, uploadId }
 *
 * Body: { guidelineId: string }  (used as Mux passthrough so the webhook
 *        knows which guideline the asset belongs to)
 *
 * Auth: editor must be logged in AND own the guideline.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { guidelineId } = await req.json().catch(() => ({}));
  if (!guidelineId) return NextResponse.json({ error: "guidelineId required" }, { status: 400 });

  const { data: gl, error } = await supabase
    .from("guidelines")
    .select("id")
    .eq("id", guidelineId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (error || !gl) return NextResponse.json({ error: "not found" }, { status: 404 });

  const origin = new URL(req.url).origin;
  const upload = await createDirectUpload({
    corsOrigin: origin,
    passthrough: JSON.stringify({ guidelineId, userId: user.id }),
  });

  return NextResponse.json(upload);
}
