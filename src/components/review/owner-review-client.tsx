"use client";

import * as React from "react";
import type { AssetDTO, ProjectDTO } from "@/lib/review/types";
import { ReviewWorkspace, type ReviewApi } from "./review-workspace";
import { ReviewShareDialog } from "./share-dialog";

/**
 * Owner-side wrapper around ReviewWorkspace: provides the authed API
 * implementation (talks to /api/review/...) and the share dialog.
 */
export function OwnerReviewClient({ asset, project }: { asset: AssetDTO; project: ProjectDTO }) {
  const [shareOpen, setShareOpen] = React.useState(false);

  const api = React.useMemo<ReviewApi>(
    () => ({
      async loadComments(versionId) {
        const res = await fetch(`/api/review/comments/list?versionId=${versionId}`, { cache: "no-store" });
        if (!res.ok) {
          const msg = await res.json().then((j) => j.error).catch(() => null);
          throw new Error(`${res.status} ${msg ?? "load failed"}`);
        }
        return res.json();
      },
      async createComment(input) {
        const res = await fetch("/api/review/comments", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          const msg = await res.json().then((j) => j.error).catch(() => null);
          throw new Error(msg ?? "create failed");
        }
      },
      async setStatus(commentId, status) {
        const res = await fetch(`/api/review/comments/${commentId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status }),
        });
        if (!res.ok) throw new Error("status failed");
      },
      async deleteComment(commentId) {
        const res = await fetch(`/api/review/comments/${commentId}`, { method: "DELETE" });
        if (!res.ok) throw new Error("delete failed");
      },
      async editComment(commentId, body) {
        const res = await fetch(`/api/review/comments/${commentId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ body }),
        });
        if (!res.ok) throw new Error("edit failed");
      },
      async editAnnotation(annotationId, coordinates) {
        const res = await fetch(`/api/review/annotations/${annotationId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ coordinates }),
        });
        if (!res.ok) throw new Error("annotation failed");
      },
    }),
    [],
  );

  return (
    <>
      <ReviewWorkspace
        asset={asset}
        mode="owner"
        api={api}
        shareSlug={project.shareSlug}
        allowDownload={project.allowDownload}
        onShare={() => setShareOpen(true)}
      />
      <ReviewShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        projectId={project.id}
        slug={project.shareSlug}
        hasPassword={project.hasPassword}
        allowDownload={project.allowDownload}
      />
    </>
  );
}
