"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CreateGuidelineButton() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  async function onCreate() {
    setLoading(true);
    try {
      const res = await fetch("/api/guidelines", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      router.push(`/app/guidelines/${json.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create brief");
      setLoading(false);
    }
  }

  return (
    <Button onClick={onCreate} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus />}
      New brief
    </Button>
  );
}
