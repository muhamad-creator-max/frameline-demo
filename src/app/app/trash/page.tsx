import { createClient } from "@/lib/supabase/server";
import { TrashList } from "@/components/trash/trash-list";

export const dynamic = "force-dynamic";

export default async function TrashPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: guidelines }, { data: responses }] = await Promise.all([
    supabase
      .from("guidelines")
      .select("id, title, deleted_at")
      .eq("owner_id", user!.id)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
    supabase
      .from("responses")
      .select("id, client_name, deleted_at, guideline:guidelines(title, owner_id)")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
  ]);

  const ownedResponses = (responses ?? [])
    .filter((r) => (r.guideline as { owner_id?: string } | null)?.owner_id === user!.id)
    .map((r) => ({
      id: r.id,
      label: `${r.client_name}'s response to ${(r.guideline as { title?: string } | null)?.title ?? "—"}`,
      deleted_at: r.deleted_at!,
      kind: "response" as const,
    }));

  const guidelineItems = (guidelines ?? []).map((g) => ({
    id: g.id,
    label: g.title || "Untitled brief",
    deleted_at: g.deleted_at!,
    kind: "guideline" as const,
  }));

  return <TrashList items={[...guidelineItems, ...ownedResponses]} />;
}
