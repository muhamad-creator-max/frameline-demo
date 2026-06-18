"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CheckoutButton({
  priceId,
  children,
}: {
  priceId: string;
  children: React.ReactNode;
}) {
  const [loading, setLoading] = React.useState(false);
  async function go() {
    if (!priceId) {
      toast.error("Pricing not configured yet");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Checkout failed");
      window.location.href = json.url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Checkout failed");
      setLoading(false);
    }
  }
  return (
    <Button onClick={go} disabled={loading} className="w-full">
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </Button>
  );
}

export function ManageBillingButton() {
  const [loading, setLoading] = React.useState(false);
  async function go() {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Portal failed");
      window.location.href = json.url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Portal failed");
      setLoading(false);
    }
  }
  return (
    <Button onClick={go} variant="secondary" disabled={loading} className="w-full">
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      Manage billing
    </Button>
  );
}
