import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProjectsList, type ProjectCard } from "@/components/review/projects-list";

export const metadata = { title: "Review" };

export default async function ReviewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: projectsRaw } = await supabase
    .from("review_projects")
    .select("id, name, view_count, updated_at, review_assets(count)")
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  // The aggregate embed isn't represented in our hand-written types.
  const projects = (projectsRaw ?? []) as unknown as Array<{
    id: string;
    name: string;
    view_count: number;
    updated_at: string;
    review_assets: { count: number }[] | null;
  }>;

  const cards: ProjectCard[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    viewCount: p.view_count,
    updatedAt: p.updated_at,
    assetCount: p.review_assets?.[0]?.count ?? 0,
  }));

  return <ProjectsList projects={cards} />;
}
