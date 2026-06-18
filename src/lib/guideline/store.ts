"use client";

import { create } from "zustand";
import { nanoid } from "nanoid";
import type { Attachment, SettingCell } from "@/lib/supabase/database.types";

// Question/option IDs need to be valid UUIDs because the DB columns are `uuid`.
// Setting-cell and attachment IDs live inside jsonb so any short slug is fine.
const uuid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : // Fallback for very old browsers — RFC4122 v4-ish.
      "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });

export type QuestionKind = "choice" | "like" | "answer" | "message";
export type MediaKind = "image" | "gif" | "video" | "text";

export interface BuilderOption {
  id: string;
  position: number;
  label: string;
  media_kind: MediaKind;
  media_url: string | null;
  media_provider: "bunny" | "mux" | "external" | null;
  media_meta: Record<string, unknown>;
  settings: SettingCell[];
  attachments: Attachment[];
  /** Conditional reveal: if this option is selected, also show these question ids. */
  reveal_question_ids: string[];
}

export interface BuilderQuestion {
  id: string;
  position: number;
  kind: QuestionKind;
  title: string;
  helper: string;
  required: boolean;
  allow_comment: boolean;
  settings: SettingCell[];
  attachments: Attachment[];
  options: BuilderOption[];
}

export interface BuilderGuideline {
  id: string;
  title: string;
  description: string;
  cover_color: string;
  one_question_per_screen: boolean;
  ready_to_go: boolean;
  share_slug: string | null;
  password_hash: string | null;
  status: "draft" | "published" | "archived";
}

interface BuilderState {
  guideline: BuilderGuideline | null;
  questions: BuilderQuestion[];
  dirty: boolean;
  selectedQuestionId: string | null;

  hydrate: (g: BuilderGuideline, qs: BuilderQuestion[]) => void;
  setMeta: (patch: Partial<BuilderGuideline>) => void;

  // Questions
  addQuestion: (kind: QuestionKind) => string;
  updateQuestion: (id: string, patch: Partial<BuilderQuestion>) => void;
  removeQuestion: (id: string) => void;
  moveQuestion: (id: string, dir: -1 | 1) => void;
  reorderQuestion: (fromId: string, toId: string) => void;
  selectQuestion: (id: string | null) => void;

  // Options
  addOption: (questionId: string, init?: Partial<BuilderOption>) => string;
  updateOption: (questionId: string, optionId: string, patch: Partial<BuilderOption>) => void;
  removeOption: (questionId: string, optionId: string) => void;

  // Settings cells & attachments — works for both question.* and option.* targets
  addSettingCell: (target: SettingTarget) => void;
  updateSettingCell: (target: SettingTarget, cellId: string, patch: Partial<SettingCell>) => void;
  removeSettingCell: (target: SettingTarget, cellId: string) => void;
  addAttachment: (target: SettingTarget, att: Attachment) => void;
  removeAttachment: (target: SettingTarget, attachmentId: string) => void;

  markClean: () => void;
}

export type SettingTarget =
  | { type: "question"; questionId: string }
  | { type: "option"; questionId: string; optionId: string };

const blankSettings: SettingCell[] = [];
const blankAttachments: Attachment[] = [];

export const useBuilder = create<BuilderState>((set) => ({
  guideline: null,
  questions: [],
  dirty: false,
  selectedQuestionId: null,

  hydrate: (g, qs) => set({ guideline: g, questions: qs, dirty: false }),
  setMeta: (patch) =>
    set((s) => ({
      guideline: s.guideline ? { ...s.guideline, ...patch } : s.guideline,
      dirty: true,
    })),

  addQuestion: (kind) => {
    const id = uuid();
    set((s) => ({
      questions: [
        ...s.questions,
        {
          id,
          position: s.questions.length,
          kind,
          title: "",
          helper: "",
          required: false,
          allow_comment: true,
          settings: [...blankSettings],
          attachments: [...blankAttachments],
          options: kind === "choice" || kind === "like" ? defaultOptions(kind) : [],
          // "message" kind never has options — it's a section divider.
        },
      ],
      dirty: true,
      selectedQuestionId: id,
    }));
    return id;
  },

  updateQuestion: (id, patch) =>
    set((s) => ({
      questions: s.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)),
      dirty: true,
    })),

  removeQuestion: (id) =>
    set((s) => ({
      questions: s.questions
        .filter((q) => q.id !== id)
        .map((q, i) => ({ ...q, position: i })),
      dirty: true,
      selectedQuestionId: s.selectedQuestionId === id ? null : s.selectedQuestionId,
    })),

  moveQuestion: (id, dir) =>
    set((s) => {
      const idx = s.questions.findIndex((q) => q.id === id);
      const next = idx + dir;
      if (idx < 0 || next < 0 || next >= s.questions.length) return s;
      const arr = [...s.questions];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return { questions: arr.map((q, i) => ({ ...q, position: i })), dirty: true };
    }),

  reorderQuestion: (fromId, toId) =>
    set((s) => {
      const fromIdx = s.questions.findIndex((q) => q.id === fromId);
      const toIdx = s.questions.findIndex((q) => q.id === toId);
      if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return s;
      const arr = [...s.questions];
      const [item] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, item);
      return { questions: arr.map((q, i) => ({ ...q, position: i })), dirty: true };
    }),

  selectQuestion: (id) => set({ selectedQuestionId: id }),

  addOption: (questionId, init) => {
    const id = uuid();
    set((s) => ({
      questions: s.questions.map((q) =>
        q.id === questionId
          ? {
              ...q,
              options: [
                ...q.options,
                {
                  id,
                  position: q.options.length,
                  label: "",
                  media_kind: "text",
                  media_url: null,
                  media_provider: null,
                  media_meta: {},
                  settings: [],
                  attachments: [],
                  reveal_question_ids: [],
                  ...init,
                },
              ],
            }
          : q,
      ),
      dirty: true,
    }));
    return id;
  },

  updateOption: (questionId, optionId, patch) =>
    set((s) => ({
      questions: s.questions.map((q) =>
        q.id === questionId
          ? {
              ...q,
              options: q.options.map((o) => (o.id === optionId ? { ...o, ...patch } : o)),
            }
          : q,
      ),
      dirty: true,
    })),

  removeOption: (questionId, optionId) =>
    set((s) => ({
      questions: s.questions.map((q) =>
        q.id === questionId
          ? { ...q, options: q.options.filter((o) => o.id !== optionId).map((o, i) => ({ ...o, position: i })) }
          : q,
      ),
      dirty: true,
    })),

  addSettingCell: (target) =>
    set((s) => ({
      questions: applyToTarget(s.questions, target, (host) => ({
        ...host,
        settings: [...host.settings, { id: nanoid(8), label: "", value: "" }],
      })),
      dirty: true,
    })),

  updateSettingCell: (target, cellId, patch) =>
    set((s) => ({
      questions: applyToTarget(s.questions, target, (host) => ({
        ...host,
        settings: host.settings.map((c) => (c.id === cellId ? { ...c, ...patch } : c)),
      })),
      dirty: true,
    })),

  removeSettingCell: (target, cellId) =>
    set((s) => ({
      questions: applyToTarget(s.questions, target, (host) => ({
        ...host,
        settings: host.settings.filter((c) => c.id !== cellId),
      })),
      dirty: true,
    })),

  addAttachment: (target, att) =>
    set((s) => ({
      questions: applyToTarget(s.questions, target, (host) => ({
        ...host,
        attachments: [...host.attachments, att],
      })),
      dirty: true,
    })),

  removeAttachment: (target, attachmentId) =>
    set((s) => ({
      questions: applyToTarget(s.questions, target, (host) => ({
        ...host,
        attachments: host.attachments.filter((a) => a.id !== attachmentId),
      })),
      dirty: true,
    })),

  markClean: () => set({ dirty: false }),
}));

function defaultOptions(kind: QuestionKind): BuilderOption[] {
  if (kind === "like") {
    return [];
  }
  return [
    {
      id: uuid(),
      position: 0,
      label: "Option A",
      media_kind: "text",
      media_url: null,
      media_provider: null,
      media_meta: {},
      settings: [],
      attachments: [],
      reveal_question_ids: [],
    },
    {
      id: uuid(),
      position: 1,
      label: "Option B",
      media_kind: "text",
      media_url: null,
      media_provider: null,
      media_meta: {},
      settings: [],
      attachments: [],
      reveal_question_ids: [],
    },
  ];
}

type HostWithSettings = { settings: SettingCell[]; attachments: Attachment[] };

function applyToTarget(
  questions: BuilderQuestion[],
  target: SettingTarget,
  fn: <T extends HostWithSettings>(host: T) => T,
): BuilderQuestion[] {
  return questions.map((q) => {
    if (target.type === "question" && q.id === target.questionId) {
      return fn(q);
    }
    if (target.type === "option" && q.id === target.questionId) {
      return {
        ...q,
        options: q.options.map((o) => (o.id === target.optionId ? fn(o) : o)),
      };
    }
    return q;
  });
}
