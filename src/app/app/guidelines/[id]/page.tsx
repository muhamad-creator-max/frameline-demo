import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GuidelineBuilder } from "@/components/builder/guideline-builder";

export const dynamic = "force-dynamic";

export default async function GuidelineEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: guideline } = await supabase
    .from("guidelines")
    .select("*")
    .eq("id", id)
    .eq("owner_id", user!.id)
    .maybeSingle();

  if (!guideline) notFound();

  const { data: questions } = await supabase
    .from("questions")
    .select("*, options(*)")
    .eq("guideline_id", id)
    .order("position", { ascending: true });

  const hydrated = (questions ?? []).map((q) => ({
    id: q.id,
    position: q.position,
    kind: q.kind,
    title: q.title,
    helper: q.helper ?? "",
    required: q.required,
    allow_comment: q.allow_comment,
    settings: (q.settings as []) ?? [],
    attachments: (q.attachments as []) ?? [],
    options: ((q.options as []) ?? [])
      .sort((a: { position: number }, b: { position: number }) => a.position - b.position)
      .map((o: {
        id: string; position: number; label: string | null;
        media_kind: "image" | "gif" | "video" | "text"; media_url: string | null;
        media_provider: "bunny" | "mux" | "external" | null;
        media_meta: Record<string, unknown>; settings: []; attachments: [];
      }) => ({
        id: o.id,
        position: o.position,
        label: o.label ?? "",
        media_kind: o.media_kind,
        media_url: o.media_url,
        media_provider: o.media_provider,
        media_meta: o.media_meta ?? {},
        settings: o.settings ?? [],
        attachments: o.attachments ?? [],
      })),
  }));

  return (
    <GuidelineBuilder
      initialGuideline={{
        id: guideline.id,
        title: guideline.title,
        description: guideline.description ?? "",
        cover_color: guideline.cover_color,
        one_question_per_screen: guideline.one_question_per_screen,
        ready_to_go: guideline.ready_to_go ?? false,
        share_slug: guideline.share_slug,
        password_hash: guideline.password_hash,
        status: guideline.status,
      }}
      initialQuestions={hydrated}
    />
  );
}
