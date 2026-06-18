import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { GuidelineSnapshotPayload } from "@/lib/supabase/database.types";
import { formatDate } from "@/lib/utils";
import { ResponseDetail } from "@/components/responses/response-detail";

export const dynamic = "force-dynamic";

export default async function ResponseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: response } = await supabase
    .from("responses")
    .select(
      "*, snapshot:guideline_snapshots(id, payload), guideline:guidelines(id, title, owner_id)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!response) notFound();
  if ((response.guideline as { owner_id: string })?.owner_id !== user!.id) notFound();

  const { data: answers = [] } = await supabase
    .from("answers")
    .select("*")
    .eq("response_id", id);

  // Pull the sibling responses for the same guideline so the left list works.
  const guideline = response.guideline as { id: string; title: string };
  const { data: siblings = [] } = await supabase
    .from("responses")
    .select("id, client_name, status, submitted_at, started_at")
    .eq("guideline_id", guideline.id)
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .order("started_at", { ascending: false });

  const snapshot = (response.snapshot as { payload: GuidelineSnapshotPayload }).payload;

  return (
    <ResponseDetail
      guideline={guideline}
      response={{
        id: response.id,
        client_name: response.client_name,
        status: response.status,
        submitted: response.submitted_at ? formatDate(response.submitted_at) : "In progress",
      }}
      siblings={(siblings ?? []).map((s) => ({
        id: s.id,
        client_name: s.client_name,
        status: s.status,
        submitted: s.submitted_at ? formatDate(s.submitted_at) : "In progress",
        done: s.status === "submitted",
      }))}
      snapshot={snapshot}
      answers={answers ?? []}
    />
  );
}
