"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Clapperboard, MoreHorizontal, Trash2, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface ProjectCard {
  id: string;
  name: string;
  assetCount: number;
  viewCount: number;
  updatedAt: string;
}

export function ProjectsList({ projects }: { projects: ProjectCard[] }) {
  const router = useRouter();
  const [creating, setCreating] = React.useState(false);

  async function create() {
    setCreating(true);
    try {
      const res = await fetch("/api/review/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Untitled project" }),
      });
      if (!res.ok) throw new Error();
      const { id } = await res.json();
      router.push(`/app/review/${id}`);
    } catch {
      toast.error("Failed to create project");
      setCreating(false);
    }
  }

  async function rename(id: string, current: string) {
    const name = window.prompt("Project name", current);
    if (!name || name === current) return;
    const res = await fetch(`/api/review/projects/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) router.refresh();
    else toast.error("Failed to rename");
  }

  async function trash(id: string) {
    if (!confirm("Move this project to trash?")) return;
    const res = await fetch(`/api/review/projects/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else toast.error("Failed to delete");
  }

  return (
    <div style={{ padding: "26px 32px", maxWidth: "var(--maxw)", margin: "0 auto", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Review</h1>
          <p style={{ fontSize: 13.5, color: "var(--text-2)", margin: "4px 0 0" }}>
            Upload media, share for review, and collect frame-accurate feedback.
          </p>
        </div>
        <button
          type="button"
          onClick={create}
          disabled={creating}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "9px 15px",
            borderRadius: 9,
            border: "none",
            background: "var(--accent)",
            color: "var(--accent-contrast)",
            fontSize: 13.5,
            fontWeight: 500,
            cursor: creating ? "default" : "pointer",
            boxShadow: "var(--glow)",
          }}
        >
          {creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={16} />}
          New project
        </button>
      </div>

      {projects.length === 0 ? (
        <div
          style={{
            border: "1.5px dashed var(--border-2)",
            borderRadius: "var(--r-lg)",
            padding: "56px 24px",
            textAlign: "center",
            color: "var(--text-2)",
          }}
        >
          <Clapperboard size={34} style={{ color: "var(--text-3)", marginBottom: 12 }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", margin: "0 0 4px" }}>No review projects yet</p>
          <p style={{ fontSize: 13.5, margin: "0 0 18px" }}>Create your first project to upload and share media.</p>
          <button
            type="button"
            onClick={create}
            disabled={creating}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "9px 16px",
              borderRadius: 9,
              border: "none",
              background: "var(--accent)",
              color: "var(--accent-contrast)",
              fontSize: 13.5,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <Plus size={16} /> New project
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(248px, 1fr))",
            gap: 16,
          }}
        >
          {projects.map((p) => (
            <div
              key={p.id}
              style={{
                borderRadius: "var(--r-md)",
                border: "1px solid var(--border-raw)",
                background: "var(--surface)",
                overflow: "hidden",
                position: "relative",
              }}
            >
              <Link href={`/app/review/${p.id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                <div
                  style={{
                    aspectRatio: "16 / 9",
                    background: "linear-gradient(135deg, var(--surface-2), var(--bg-2))",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <Clapperboard size={30} style={{ color: "var(--text-3)" }} />
                </div>
                <div style={{ padding: "12px 13px" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.name}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6, fontSize: 12, color: "var(--text-3)" }}>
                    <span>{p.assetCount} {p.assetCount === 1 ? "file" : "files"}</span>
                  </div>
                </div>
              </Link>
              <div style={{ position: "absolute", insetBlockStart: 8, insetInlineEnd: 8 }}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      style={{
                        border: "none",
                        background: "rgba(0,0,0,.35)",
                        color: "#fff",
                        cursor: "pointer",
                        padding: 4,
                        borderRadius: 6,
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      <MoreHorizontal size={15} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => rename(p.id, p.name)} className="text-[13px]">
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => trash(p.id)} className="text-[13px] text-destructive focus:text-destructive">
                      <Trash2 size={13} className="mr-2" /> Move to trash
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
