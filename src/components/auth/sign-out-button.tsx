"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function SignOutButton({ children }: { children?: React.ReactNode }) {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
      {children ?? "Sign out"}
    </Button>
  );
}
