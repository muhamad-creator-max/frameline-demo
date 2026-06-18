import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { newShareSlug } from "@/lib/utils";

export const runtime = "nodejs";

/**
 * Duplicate a guideline (questions + options + their jsonb cargo).
 * Snapshots and responses are NOT copied — the new copy starts fresh as a draft.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const { data: source } = await supabase
    .from("guidelines")
    .select("*, questions(*, options(*))")
    .eq("id", id)
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!source) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Insert duplicated guideline.
  const { data: copy, error } = await admin
    .from("guidelines")
    .insert({
      owner_id: user.id,
      title: `${source.title} (copy)`,
      description: source.description,
      cover_color: source.cover_color,
      one_question_per_screen: source.one_question_per_screen,
      status: "draft",
      share_slug: newShareSlug(),
      current_version: 0,
    })
    .select("id")
    .single();
  if (error || !copy) return NextResponse.json({ error: error?.message ?? "copy failed" }, { status: 500 });

  // Map old question id -> new question id, so we can rewrite reveal_question_ids.
  const qIdMap = new Map<string, string>();
  for (const q of (source.questions as { id: string }[]) ?? []) {
    qIdMap.set(q.id, crypto.randomUUID());
  }

  const questions = (source.questions as Array<{
    id: string; position: number; kind: string; title: string; helper: string | null;
    required: boolean; allow_comment: boolean; settings: unknown; attachments: unknown;
    options: Array<{
      id: string; position: number; label: string | null;
      media_kind: "image" | "gif" | "video" | "text"; media_url: string | null;
      media_provider: "bunny" | "mux" | "external" | null;
      media_meta: Record<string, unknown>; settings: unknown; attachments: unknown;
      reveal_question_ids: string[];
    }>;
  }>) ?? [];

  for (const q of questions) {
    const newQId = qIdMap.get(q.id)!;
    await admin.from("questions").insert({
      id: newQId,
      guideline_id: copy.id,
      position: q.position,
      kind: q.kind as never,
      title: q.title,
      helper: q.helper,
      required: true,
      allow_comment: q.allow_comment,
      settings: q.settings as never,
      attachments: q.attachments as never,
    });

    for (const o of q.options ?? []) {
      await admin.from("options").insert({
        question_id: newQId,
        position: o.position,
        label: o.label,
        media_kind: o.media_kind,
        media_url: o.media_url,
        media_provider: o.media_provider,
        media_meta: o.media_meta as never,
        settings: o.settings as never,
        attachments: o.attachments as never,
        // Rewrite reveal refs to the new question IDs.
        reveal_question_ids: (o.reveal_question_ids ?? [])
          .map((qid) => qIdMap.get(qid))
          .filter((x): x is string => !!x),
      });
    }
  }

  return NextResponse.json({ id: copy.id });
}
