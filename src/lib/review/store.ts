"use client";

import { create } from "zustand";
import type { AnnotationCoordinates, AnnotationType, CommentStatus } from "@/lib/supabase/database.types";
import type { CommentDTO, DrawTool } from "@/lib/review/types";

/** An annotation being drawn but not yet saved (lives only in memory). */
export interface DraftAnnotation {
  type: AnnotationType;
  timestampSeconds: number;
  coordinates: AnnotationCoordinates;
  color: string;
  strokeWidth: number;
}

interface ReviewState {
  // ── playback ──
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  setCurrentTime: (t: number) => void;
  setDuration: (d: number) => void;
  setPlaying: (p: boolean) => void;

  // ── active version ──
  versionId: string | null;
  setVersionId: (id: string) => void;

  // ── drawing ──
  tool: DrawTool;
  color: string;
  strokeWidth: number;
  /** True while the annotate overlay is active (video is paused for drawing). */
  annotating: boolean;
  setTool: (t: DrawTool) => void;
  setColor: (c: string) => void;
  setStrokeWidth: (w: number) => void;
  setAnnotating: (a: boolean) => void;

  /** Annotations drawn but not yet attached to a saved comment (one or more shapes). */
  drafts: DraftAnnotation[];
  setDrafts: (d: DraftAnnotation[]) => void;

  // ── selection / display ──
  /** Comment whose annotation(s) should be shown + highlighted on the canvas. */
  activeCommentId: string | null;
  setActiveCommentId: (id: string | null) => void;

  // ── comments ──
  comments: CommentDTO[];
  setComments: (c: CommentDTO[]) => void;
  /** Optimistically insert a top-level comment or a reply. */
  addComment: (c: CommentDTO) => void;
  updateComment: (id: string, patch: Partial<CommentDTO>) => void;
  setCommentStatus: (id: string, status: CommentStatus) => void;
  removeComment: (id: string) => void;

  /** Reset transient drawing state (called when switching versions). */
  resetDrawing: () => void;
}

function mapTree(
  comments: CommentDTO[],
  id: string,
  fn: (c: CommentDTO) => CommentDTO,
): CommentDTO[] {
  return comments.map((c) => {
    if (c.id === id) return fn(c);
    if (c.replies.length) return { ...c, replies: mapTree(c.replies, id, fn) };
    return c;
  });
}

function dropFromTree(comments: CommentDTO[], id: string): CommentDTO[] {
  return comments
    .filter((c) => c.id !== id)
    .map((c) => (c.replies.length ? { ...c, replies: dropFromTree(c.replies, id) } : c));
}

export const useReviewStore = create<ReviewState>((set) => ({
  currentTime: 0,
  duration: 0,
  isPlaying: false,
  setCurrentTime: (t) => set({ currentTime: t }),
  setDuration: (d) => set({ duration: d }),
  setPlaying: (p) => set({ isPlaying: p }),

  versionId: null,
  setVersionId: (id) => set({ versionId: id }),

  tool: "select",
  color: "#ff3b30",
  strokeWidth: 3,
  annotating: false,
  setTool: (t) => set({ tool: t }),
  setColor: (c) => set({ color: c }),
  setStrokeWidth: (w) => set({ strokeWidth: w }),
  setAnnotating: (a) => set({ annotating: a, tool: a ? "arrow" : "select" }),

  drafts: [],
  // Skip redundant empty→empty sets so an effect re-emitting "no drafts" can't
  // bounce the store and trigger a render loop.
  setDrafts: (d) => set((s) => (s.drafts.length === 0 && d.length === 0 ? s : { drafts: d })),

  activeCommentId: null,
  setActiveCommentId: (id) => set({ activeCommentId: id }),

  comments: [],
  setComments: (comments) => set({ comments }),
  addComment: (c) =>
    set((s) => {
      if (c.parentId) {
        return { comments: mapTree(s.comments, c.parentId, (p) => ({ ...p, replies: [...p.replies, c] })) };
      }
      return { comments: [...s.comments, c] };
    }),
  updateComment: (id, patch) =>
    set((s) => ({ comments: mapTree(s.comments, id, (c) => ({ ...c, ...patch })) })),
  setCommentStatus: (id, status) =>
    set((s) => ({ comments: mapTree(s.comments, id, (c) => ({ ...c, status })) })),
  removeComment: (id) => set((s) => ({ comments: dropFromTree(s.comments, id) })),

  resetDrawing: () =>
    set({ tool: "select", annotating: false, drafts: [], activeCommentId: null }),
}));
