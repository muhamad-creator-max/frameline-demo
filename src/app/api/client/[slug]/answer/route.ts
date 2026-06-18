import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = await req.json();
  const supabase = createAdminClient();

  // Validate that responseId belongs to this slug
  const { data: response } = await supabase
    .from("responses")
    .select("id, guideline_id, status")
    .eq("id", body.responseId)
    .maybeSingle();
  if (!response) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (response.status === "submitted") {
    return NextResponse.json({ error: "already submitted" }, { status: 409 });
  }

  const { data: guideline } = await supabase
    .from("guidelines")
    .select("share_slug")
    .eq("id", response.guideline_id)
    .maybeSingle();
  if (guideline?.share_slug !== slug) {
    return NextResponse.json({ error: "mismatch" }, { status: 400 });
  }

  await supabase.from("answers").upsert(
    {
      response_id: body.responseId,
      question_id: body.questionId,
      selected_option_ids: body.selectedOptionIds,
      liked: body.liked,
      text_value: body.textValue,
      comment_text: body.commentText,
      comment_attachments: body.commentAttachments ?? [],
    },
    { onConflict: "response_id,question_id" },
  );

  return NextResponse.json({ ok: true });
}
