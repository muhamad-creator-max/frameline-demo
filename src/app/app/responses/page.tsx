import { createClient } from "@/lib/supabase/server";
import { ResponsesFeed } from "@/components/responses/responses-feed";

export const dynamic = "force-dynamic";

export default async function ResponsesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: rows = [] } = await supabase
    .from("responses")
    .select(
      "id, client_name, status, started_at, submitted_at, guideline:guidelines(id, title, owner_id, share_slug)",
    )
    .is("deleted_at", null)
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .order("started_at", { ascending: false })
    .limit(200);

  const owned = (rows ?? [])
    .filter((r) => (r.guideline as { owner_id?: string } | null)?.owner_id === user!.id)
    .map((r) => ({
      id: r.id,
      client_name: r.client_name,
      status: r.status as "in_progress" | "submitted",
      guideline_id: (r.guideline as { id?: string } | null)?.id ?? "",
      guideline_title: (r.guideline as { title?: string } | null)?.title ?? "",
      share_slug: (r.guideline as { share_slug?: string } | null)?.share_slug ?? "",
      at: r.submitted_at ?? r.started_at,
    }));

  return <ResponsesFeed items={owned} />;
}
