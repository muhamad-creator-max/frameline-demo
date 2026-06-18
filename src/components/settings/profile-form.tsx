"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function ProfileForm({
  initial,
}: {
  initial: { full_name: string; locale: "en" | "ar" };
}) {
  const supabase = React.useMemo(() => createClient(), []);
  const [fullName, setFullName] = React.useState(initial.full_name);
  const [locale, setLocale] = React.useState<"en" | "ar">(initial.locale);
  const [saving, setSaving] = React.useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, locale })
      .eq("id", user.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Saved");
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="full_name">Full name</Label>
        <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="locale">Default language</Label>
        <select
          id="locale"
          value={locale}
          onChange={(e) => setLocale(e.target.value as "en" | "ar")}
          className="h-10 rounded-xl border border-input bg-background px-4 text-sm"
        >
          <option value="en">English</option>
          <option value="ar">العربية (Arabic)</option>
        </select>
      </div>
      <Button type="submit" disabled={saving} className="self-start">
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Save changes
      </Button>
    </form>
  );
}
