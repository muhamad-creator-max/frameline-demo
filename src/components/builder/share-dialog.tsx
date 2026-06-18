"use client";

import * as React from "react";
import { Copy, Check, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { absoluteUrl } from "@/lib/utils";

export function ShareDialog({
  open,
  onOpenChange,
  guidelineId,
  slug,
  hasPassword,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  guidelineId: string;
  slug: string;
  hasPassword: boolean;
}) {
  const shareUrl = slug ? absoluteUrl(`/c/${slug}`) : "";
  const [copied, setCopied] = React.useState(false);
  const [password, setPassword] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [protected_, setProtected_] = React.useState(hasPassword);

  React.useEffect(() => setProtected_(hasPassword), [hasPassword]);

  async function copy() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Link copied");
    setTimeout(() => setCopied(false), 1500);
  }

  async function savePassword(clear: boolean) {
    setSaving(true);
    try {
      const res = await fetch(`/api/guidelines/${guidelineId}/password`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: clear ? null : password }),
      });
      if (!res.ok) throw new Error("Failed");
      setProtected_(!clear);
      setPassword("");
      toast.success(clear ? "Password removed" : "Password set");
    } catch {
      toast.error("Failed to update password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share with your client</DialogTitle>
          <DialogDescription>
            Send this link. No account needed — your client just enters their name and answers.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Input value={shareUrl} readOnly className="font-mono text-xs" />
            <Button onClick={copy} className="shrink-0">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>

          <div className="rounded-xl border border-border p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              {protected_ ? <Lock className="h-4 w-4 text-primary" /> : <Unlock className="h-4 w-4" />}
              {protected_ ? "Password protected" : "Public link"}
            </div>
            {protected_ ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-muted-foreground">
                  Your client will be asked for the password before they can view this brief.
                </p>
                <Button variant="secondary" size="sm" disabled={saving} onClick={() => savePassword(true)}>
                  Remove password
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Label htmlFor="pw" className="text-xs">Set a password (optional)</Label>
                <div className="flex gap-2">
                  <Input
                    id="pw"
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="e.g. neon42"
                    className="h-9 font-mono text-xs"
                  />
                  <Button
                    size="sm"
                    onClick={() => savePassword(false)}
                    disabled={!password || saving}
                  >
                    Save
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
