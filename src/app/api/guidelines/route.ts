import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { newShareSlug } from "@/lib/utils";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("guidelines")
    .insert({
      owner_id: user.id,
      title: "Untitled brief",
      share_slug: newShareSlug(),
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
