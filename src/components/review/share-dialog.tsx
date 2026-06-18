"use client";

import * as React from "react";
import { Copy, Check, Lock, Unlock, Download } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { absoluteUrl } from "@/lib/utils";

/**
 * Share a review project with a client: copy link, set/clear password, toggle
 * downloads. Mirrors the guidelines ShareDialog but talks to the review API.
 */
export function ReviewShareDialog({
  open,
  onOpenChange,
  projectId,
  slug,
  hasPassword,
  allowDownload,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  slug: string | null;
  hasPassword: boolean;
  allowDownload: boolean;
}) {
  const [shareSlug, setShareSlug] = React.useState(slug);
  const shareUrl = shareSlug ? absoluteUrl(`/r/${shareSlug}`) : "";
  const [copied, setCopied] = React.useState(false);
  const [password, setPassword] = React.useState("");
  const [protectedOn, setProtectedOn] = React.useState(hasPassword);
  const [download, setDownload] = React.useState(allowDownload);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => setShareSlug(slug), [slug]);

  // Ensure a slug exists when the dialog first opens.
  React.useEffect(() => {
    if (open && !shareSlug) {
      fetch(`/api/review/projects/${projectId}/share`, { method: "POST" })
        .then((r) => r.json())
        .then((d) => d.shareSlug && setShareSlug(d.shareSlug))
        .catch(() => {});
    }
  }, [open, shareSlug, projectId]);

  async function copy() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Link copied");
    setTimeout(() => setCopied(false), 1500);
  }

  async function savePassword(clear: boolean) {
    setSaving(true);
    try {
      const res = await fetch(`/api/review/projects/${projectId}/password`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: clear ? null : password }),
      });
      if (!res.ok) throw new Error();
      setProtectedOn(!clear);
      setPassword("");
      toast.success(clear ? "Password removed" : "Password set");
    } catch {
      toast.error("Failed to update password");
    } finally {
      setSaving(false);
    }
  }

  async function toggleDownload(next: boolean) {
    setDownload(next);
    const res = await fetch(`/api/review/projects/${projectId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ allow_download: next }),
    });
    if (!res.ok) {
      setDownload(!next);
      toast.error("Failed to update");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share for review</DialogTitle>
          <DialogDescription>
            Send this link. No account needed — your client enters their name, then comments and annotates.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Input value={shareUrl} readOnly className="font-mono text-xs" placeholder="Generating link…" />
            <Button onClick={copy} disabled={!shareUrl} className="shrink-0">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>

          {/* password */}
          <div className="rounded-xl border border-border p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              {protectedOn ? <Lock className="h-4 w-4 text-primary" /> : <Unlock className="h-4 w-4" />}
              {protectedOn ? "Password protected" : "No password"}
            </div>
            <div className="flex gap-2">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={protectedOn ? "Set a new password" : "Add a password"}
                className="text-sm"
              />
              <Button onClick={() => savePassword(false)} disabled={!password || saving} className="shrink-0">
                Save
              </Button>
              {protectedOn && (
                <Button variant="ghost" onClick={() => savePassword(true)} disabled={saving} className="shrink-0">
                  Remove
                </Button>
              )}
            </div>
          </div>

          {/* download toggle */}
          <div className="flex items-center justify-between rounded-xl border border-border p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Download className="h-4 w-4 text-muted-foreground" />
              Allow downloads
            </div>
            <Switch checked={download} onCheckedChange={toggleDownload} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
