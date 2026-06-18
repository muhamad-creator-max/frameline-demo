import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { GuidelineSnapshotPayload } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

/**
 * PATCH /api/guidelines/:id
 *   Body: { guideline: {...}, questions: [...], publish?: boolean }
 *
 * Diffs against current DB state and applies upserts/deletes to questions/options.
 * If publish=true, also writes a guideline_snapshots row containing the full
 * frozen payload (used by the public client flow).
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    guideline: Partial<{
      title: string;
      description: string;
      cover_color: string;
      one_question_per_screen: boolean;
      ready_to_go: boolean;
      password_hash: string | null;
    }>;
    questions: Array<{
      id: string;
      position: number;
      kind: "choice" | "like" | "answer";
      title: string;
      helper: string;
      required: boolean;
      allow_comment: boolean;
      settings: unknown;
      attachments: unknown;
      options: Array<{
        id: string;
        position: number;
        label: string;
        media_kind: "image" | "gif" | "video" | "text";
        media_url: string | null;
        media_provider: "bunny" | "mux" | "external" | null;
        media_meta: Record<string, unknown>;
        settings: unknown;
        attachments: unknown;
        reveal_question_ids?: string[];
      }>;
    }>;
    publish?: boolean;
  };

  // ownership check
  const { data: existing } = await supabase
    .from("guidelines")
    .select("id, current_version")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Use admin client for writes — same reasoning as the snapshot insert:
  // we've already verified ownership above, and the RLS edge cases (jsonb
  // checks, upsert-as-insert) were swallowing failures silently.
  const admin = createAdminClient();

  // 1. Guideline meta
  const meta: Record<string, unknown> = { ...body.guideline, updated_at: new Date().toISOString() };
  if (body.publish) meta.status = "published";
  {
    const { error } = await admin.from("guidelines").update(meta).eq("id", id);
    if (error) {
      console.error("[save] guideline meta", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // 2. Reconcile questions
  const incomingQuestionIds = body.questions.map((q) => q.id);
  const { data: dbQuestions = [] } = await admin
    .from("questions")
    .select("id")
    .eq("guideline_id", id);

  const toDeleteQ = (dbQuestions ?? [])
    .filter((q) => !incomingQuestionIds.includes(q.id))
    .map((q) => q.id);
  if (toDeleteQ.length) {
    const { error } = await admin.from("questions").delete().in("id", toDeleteQ);
    if (error) console.error("[save] question delete", error);
  }

  for (const q of body.questions) {
    const { error: qErr } = await admin.from("questions").upsert({
      id: q.id,
      guideline_id: id,
      position: q.position,
      kind: q.kind,
      title: q.title,
      helper: q.helper || null,
      // Required is always true now — the "Required" toggle was removed from the UI.
      required: true,
      allow_comment: q.allow_comment,
      settings: q.settings as never,
      attachments: q.attachments as never,
    });
    if (qErr) {
      console.error("[save] question upsert", { id: q.id, qErr });
      return NextResponse.json(
        { error: `Question save failed: ${qErr.message}` },
        { status: 500 },
      );
    }

    // options
    const incomingOptionIds = q.options.map((o) => o.id);
    const { data: dbOptions = [] } = await admin
      .from("options")
      .select("id")
      .eq("question_id", q.id);
    const toDeleteO = (dbOptions ?? [])
      .filter((o) => !incomingOptionIds.includes(o.id))
      .map((o) => o.id);
    if (toDeleteO.length) {
      const { error } = await admin.from("options").delete().in("id", toDeleteO);
      if (error) console.error("[save] option delete", error);
    }

    for (const o of q.options) {
      const { error: oErr } = await admin.from("options").upsert({
        id: o.id,
        question_id: q.id,
        position: o.position,
        label: o.label || null,
        media_kind: o.media_kind,
        media_url: o.media_url,
        media_provider: o.media_provider,
        media_meta: o.media_meta as never,
        settings: o.settings as never,
        attachments: o.attachments as never,
        reveal_question_ids: o.reveal_question_ids ?? [],
      });
      if (oErr) {
        console.error("[save] option upsert", { id: o.id, oErr });
        return NextResponse.json(
          { error: `Option save failed: ${oErr.message}` },
          { status: 500 },
        );
      }
    }
  }

  // 3. Snapshot on publish — uses service role so RLS can't block,
  //    and computes the next version from the actual max snapshot to
  //    survive any past version drift.
  if (body.publish) {
    const { data: latest } = await admin
      .from("guideline_snapshots")
      .select("version")
      .eq("guideline_id", id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = Math.max(
      (latest?.version ?? 0) + 1,
      (existing.current_version ?? 0) + 1,
    );

    const payload: GuidelineSnapshotPayload = {
      title: (body.guideline.title as string) ?? "Untitled brief",
      description: body.guideline.description ?? null,
      cover_color: (body.guideline.cover_color as string) ?? "#00BE43",
      one_question_per_screen: body.guideline.one_question_per_screen ?? true,
      ready_to_go: body.guideline.ready_to_go ?? false,
      questions: body.questions.map((q) => ({
        id: q.id,
        kind: q.kind,
        title: q.title,
        helper: q.helper || null,
        required: q.required,
        allow_comment: q.allow_comment,
        settings: (q.settings as []) ?? [],
        attachments: (q.attachments as []) ?? [],
        options: q.options.map((o) => ({
          id: o.id,
          label: o.label || null,
          media_kind: o.media_kind,
          media_url: o.media_url,
          media_provider: o.media_provider,
          media_meta: o.media_meta ?? {},
          settings: (o.settings as []) ?? [],
          attachments: (o.attachments as []) ?? [],
          reveal_question_ids: o.reveal_question_ids ?? [],
        })),
      })),
    };

    const { error: snapErr } = await admin.from("guideline_snapshots").insert({
      guideline_id: id,
      version: nextVersion,
      payload: payload as never,
    });
    if (snapErr) {
      console.error("[publish] snapshot insert failed", snapErr);
      return NextResponse.json(
        { error: `Snapshot failed: ${snapErr.message}` },
        { status: 500 },
      );
    }

    const { error: updErr } = await admin
      .from("guidelines")
      .update({ current_version: nextVersion, status: "published" })
      .eq("id", id);
    if (updErr) {
      console.error("[publish] guideline update failed", updErr);
      return NextResponse.json(
        { error: `Publish failed: ${updErr.message}` },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await supabase.from("guidelines").delete().eq("id", id).eq("owner_id", user.id);
  return NextResponse.json({ ok: true });
}
