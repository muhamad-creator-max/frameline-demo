"use client";

import { create } from "zustand";
import type {
  WorkflowNodeKind,
  WorkflowNodeData,
  WorkflowCanvasState,
  WorkflowChoice,
  IdentityBox,
  QuestionAnswerConfig,
  WorkflowOptionHandoff,
  SettingCell,
  Attachment,
  PlacementConfig,
  PlacementLayer,
  PlacementTab,
  PlacementTextLayer,
  PlacementImageLayer,
} from "@/lib/supabase/database.types";
import { ANSWER_TYPE_ORDER, ANSWER_TYPE_LABEL } from "./node-theme";
import {
  DEFAULT_ASPECT,
  PLACEMENT_CARD_W,
  defaultImageLayer,
  defaultTextLayer,
  emptyTab,
  getPlacement,
  getTransform,
} from "./placement";

/** Node/edge IDs must be valid UUIDs — the DB columns are `uuid`. */
const uuid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });

// Choice/box IDs live inside jsonb, so a short slug is fine (and used as a port id).
const shortId = () => Math.random().toString(36).slice(2, 10);

export interface WorkflowProject {
  id: string;
  title: string;
  description: string;
  share_slug: string | null;
  password_hash: string | null;
  status: "draft" | "published" | "archived";
}

export interface WorkflowNode {
  id: string;
  kind: WorkflowNodeKind;
  x: number;
  y: number;
  w: number;
  h: number;
  data: WorkflowNodeData;
}

export interface WorkflowEdge {
  id: string;
  source_node_id: string;
  source_port: string;
  target_node_id: string;
  target_port: string;
  label: string | null;
}

/** A live connection being dragged from an output port (before it lands). */
export interface PendingConnection {
  sourceNodeId: string;
  sourcePort: string;
  x: number; // current pointer position in world coords
  y: number;
  /** When set, the drag started by grabbing this existing edge's end (reconnect
   *  / detach). Dropping on empty space deletes it; dropping on an input re-points it. */
  reconnectEdgeId?: string;
  /** The node this edge was detached from — magnetism ignores it until the
   *  pointer leaves its snap radius, so a tiny drag disconnects instead of re-grabbing. */
  detachedFrom?: string;
  /** Set once the pointer has left `detachedFrom`'s snap radius. Until then,
   *  releasing back on that node disconnects rather than re-creating the edge. */
  hasLeftDetach?: boolean;
}

/** Active canvas pointer tool. `select` = pick/drag nodes; `hand` = pan the field. */
export type CanvasTool = "select" | "hand";

/**
 * Patch for one placement overlay layer. Both layer shapes are covered so a
 * single action can drive the text and image tool panels; `id`/`type` are fixed
 * at creation and therefore not patchable.
 */
export type PlacementLayerPatch = Partial<Omit<PlacementTextLayer, "id" | "type">> &
  Partial<Omit<PlacementImageLayer, "id" | "type">>;

interface WorkflowState {
  project: WorkflowProject | null;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  camera: WorkflowCanvasState;
  dirty: boolean;
  /** Multi-selection. `selectedNodeId` is kept as a derived convenience for the
   *  single-node case (settings/inspector affordances). */
  selectedIds: string[];
  selectedNodeId: string | null;
  /** Nodes copied with Ctrl/⌘-C, ready to paste (deep-cloned on copy). */
  clipboard: WorkflowNode[];
  pending: PendingConnection | null;
  tool: CanvasTool;

  // Ephemeral UI state (not persisted): which node's Settings accordion is open,
  // which option's hand-off panel is open (keyed nodeId → optionKey), and the
  // hovered option key (for revealing the hand-off glasses icon).
  openSettingsNodeId: string | null;
  openHandoff: { nodeId: string; key: string } | null;
  hoveredHandoffKey: string | null;
  /** Placement: which overlay layer the tools panel is editing (ids are unique). */
  selectedLayerId: string | null;
  /** Placement: which option tab is being previewed/edited (ids are unique). */
  activeTabId: string | null;

  hydrate: (
    p: WorkflowProject,
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    camera: WorkflowCanvasState,
  ) => void;
  setMeta: (patch: Partial<WorkflowProject>) => void;
  setCamera: (camera: WorkflowCanvasState) => void;
  setTool: (tool: CanvasTool) => void;

  // Nodes
  addNode: (kind: WorkflowNodeKind, x: number, y: number) => string;
  updateNode: (id: string, patch: Partial<Omit<WorkflowNode, "data">>) => void;
  updateNodeData: (id: string, patch: Partial<WorkflowNodeData>) => void;
  moveNode: (id: string, x: number, y: number) => void;
  /** Offset every selected node by a world-space delta (group drag). */
  moveSelected: (dx: number, dy: number) => void;
  removeNode: (id: string) => void;

  // Selection
  selectNode: (id: string | null) => void;
  /** Replace the selection with `ids` (or add to it when `additive`). */
  setSelection: (ids: string[], additive?: boolean) => void;
  toggleSelected: (id: string) => void;
  clearSelection: () => void;
  selectAll: () => void;

  // Clipboard / bulk ops on the selection
  copySelection: () => void;
  pasteClipboard: (offset?: number) => void;
  duplicateSelection: () => void;
  removeSelected: () => void;

  // In-card UI toggles
  toggleSettings: (nodeId: string) => void;
  toggleHandoff: (nodeId: string, key: string) => void;
  setHoveredHandoff: (key: string | null) => void;

  // Choice helpers (choice nodes)
  addChoice: (nodeId: string) => void;
  updateChoice: (nodeId: string, choiceId: string, patch: Partial<WorkflowChoice>) => void;
  removeChoice: (nodeId: string, choiceId: string) => void;

  // Identity box helpers (identity nodes)
  addBox: (nodeId: string) => void;
  updateBox: (nodeId: string, boxId: string, patch: Partial<IdentityBox>) => void;
  removeBox: (nodeId: string, boxId: string) => void;

  // Placement helpers (placement nodes)
  updatePlacement: (nodeId: string, patch: Partial<PlacementConfig>) => void;
  /** Add an option tab — a copy of `duplicateOf` when given, else a blank one. */
  addPlacementTab: (nodeId: string, duplicateOf?: string) => string;
  updatePlacementTab: (nodeId: string, tabId: string, patch: Partial<Omit<PlacementTab, "id">>) => void;
  removePlacementTab: (nodeId: string, tabId: string) => void;
  setActiveTab: (tabId: string | null) => void;
  /** Append a text or image overlay; returns the new layer's id (for selection). */
  addPlacementLayer: (nodeId: string, tabId: string, type: "text" | "image", url?: string, name?: string) => string;
  updatePlacementLayer: (nodeId: string, tabId: string, layerId: string, patch: PlacementLayerPatch) => void;
  removePlacementLayer: (nodeId: string, tabId: string, layerId: string) => void;
  setSelectedLayer: (layerId: string | null) => void;

  // Per-option editor hand-off (keyed by option key on the node's data)
  addHandoffEffect: (nodeId: string, key: string) => void;
  updateHandoffEffect: (nodeId: string, key: string, effectId: string, patch: Partial<SettingCell>) => void;
  removeHandoffEffect: (nodeId: string, key: string, effectId: string) => void;
  setHandoffAttachment: (nodeId: string, key: string, att: Attachment | null) => void;

  // Legacy node-level hand-off (kept; used nowhere in the new UI but harmless)
  addSettingCell: (nodeId: string) => void;
  updateSettingCell: (nodeId: string, cellId: string, patch: Partial<SettingCell>) => void;
  removeSettingCell: (nodeId: string, cellId: string) => void;
  addAttachment: (nodeId: string, att: Attachment) => void;
  removeAttachment: (nodeId: string, attachmentId: string) => void;

  // Edges
  beginConnection: (sourceNodeId: string, sourcePort: string, x: number, y: number) => void;
  /** Grab the loose (input) end of an existing edge to re-point or detach it. */
  beginReconnect: (edgeId: string, x: number, y: number) => void;
  /** Mark that a reconnect drag's pointer has left the detached node's radius. */
  markLeftDetach: () => void;
  updatePending: (x: number, y: number) => void;
  endConnection: (targetNodeId: string | null) => void;
  cancelConnection: () => void;
  removeEdge: (id: string) => void;

  markClean: () => void;
}

const DEFAULT_ANSWER: QuestionAnswerConfig = {
  text: true,
  image: false,
  video: false,
  link: false,
  file: false,
};

// Shadow is a keyword ("none" | "soft" | "hard") — the body maps it to CSS.
const DEFAULT_BOX = (): IdentityBox => ({
  id: shortId(),
  bg: "#111827",
  text: "Label",
  font: "Rubik",
  lang: "latin",
  color: "#ffffff",
  textBg: "#111827",
  shadow: "soft",
  radius: 16,
});

const DEFAULT_CHOICE = (label: string): WorkflowChoice => ({
  id: shortId(),
  label,
  media_kind: "text",
  media_url: null,
  media_provider: null,
  media_meta: {},
});

/** Default geometry + payload for a freshly dropped node of each kind. */
function nodeDefaults(kind: WorkflowNodeKind): { w: number; h: number; data: WorkflowNodeData } {
  switch (kind) {
    case "start":
      return { w: 150, h: 64, data: { label: "Start" } };
    case "question":
      return {
        w: 300,
        h: 180,
        data: { title: "", helper: "", answer: { ...DEFAULT_ANSWER }, settings: [], attachments: [] },
      };
    case "choice":
      return {
        w: 320,
        h: 220,
        data: {
          title: "",
          helper: "",
          max_answers: 1,
          choices: [DEFAULT_CHOICE("Option A"), DEFAULT_CHOICE("Option B")],
          settings: [],
          attachments: [],
        },
      };
    case "identity":
      return {
        w: 320,
        h: 220,
        data: { title: "", max_answers: 1, boxes: [DEFAULT_BOX()], settings: [], attachments: [] },
      };
    case "note":
      return { w: 280, h: 150, data: { text: "" } };
    case "placement":
      return {
        w: PLACEMENT_CARD_W,
        h: 420,
        data: {
          title: "",
          // Default to requiring a response — the whole point of the node is to
          // get the client's reaction to the placement.
          required: true,
          placement: {
            tabs: [emptyTab(shortId(), "Option 1")],
            aspect: DEFAULT_ASPECT,
            respond: "text",
          },
          settings: [],
          attachments: [],
        },
      };
  }
}

/**
 * The output ports a node exposes, top-to-bottom. Each becomes a draggable
 * connector on the canvas and a branch target in the client flow (Phase 2).
 *   start    → single "out"
 *   question → one port per ENABLED answer type (text/image/video/link/file);
 *              each type can branch to a different next node. Falls back to a
 *              single "out" when nothing is enabled so the node stays connectable.
 *   choice   → one port per choice (branch on which option was picked)
 *   identity → one port per mini-box
 *   note     → single "out" (informational, then continues)
 *   placement→ single "out" (the client responds in one channel, then continues)
 */
export function outputPorts(node: WorkflowNode): Array<{ id: string; label: string }> {
  switch (node.kind) {
    case "start":
      return [{ id: "out", label: "Start" }];
    case "question": {
      const a = node.data.answer;
      const ports = ANSWER_TYPE_ORDER.filter((k) => a?.[k]).map((k) => ({
        id: k,
        label: ANSWER_TYPE_LABEL[k],
      }));
      return ports.length ? ports : [{ id: "out", label: "Answered" }];
    }
    case "choice":
      return (node.data.choices ?? []).map((c) => ({ id: c.id, label: c.label || "Choice" }));
    case "identity":
      return (node.data.boxes ?? []).map((b, i) => ({ id: b.id, label: b.text || `Box ${i + 1}` }));
    case "note":
      return [{ id: "out", label: "Continue" }];
    case "placement":
      return [{ id: "out", label: "Response" }];
  }
}

/** Whether a node accepts an incoming connection. Everything except Start. */
export function hasInputPort(node: WorkflowNode): boolean {
  return node.kind !== "start";
}

const EMPTY_HANDOFF: WorkflowOptionHandoff = { effects: [], attachment: null };

/** Read a node's hand-off for an option key (never mutates; returns a blank one). */
export function getHandoff(node: WorkflowNode, key: string): WorkflowOptionHandoff {
  return node.data.option_handoffs?.[key] ?? EMPTY_HANDOFF;
}

/** Immutably rewrite one placement option tab inside a node's data. */
function patchTab(
  node: WorkflowNode,
  tabId: string,
  fn: (tab: PlacementTab) => PlacementTab,
): WorkflowNode {
  const p = getPlacement(node.data);
  return {
    ...node,
    data: { ...node.data, placement: { ...p, tabs: p.tabs.map((t) => (t.id === tabId ? fn(t) : t)) } },
  };
}

/** Immutably update one option's hand-off inside a node's data. */
function patchHandoff(
  node: WorkflowNode,
  key: string,
  fn: (h: WorkflowOptionHandoff) => WorkflowOptionHandoff,
): WorkflowNode {
  const map = { ...(node.data.option_handoffs ?? {}) };
  map[key] = fn(map[key] ?? EMPTY_HANDOFF);
  return { ...node, data: { ...node.data, option_handoffs: map } };
}

export const useWorkflow = create<WorkflowState>((set, get) => ({
  project: null,
  nodes: [],
  edges: [],
  camera: { x: 0, y: 0, zoom: 1 },
  dirty: false,
  selectedIds: [],
  selectedNodeId: null,
  clipboard: [],
  pending: null,
  tool: "select",
  openSettingsNodeId: null,
  openHandoff: null,
  hoveredHandoffKey: null,
  selectedLayerId: null,
  activeTabId: null,

  hydrate: (project, nodes, edges, camera) =>
    set({
      project, nodes, edges, camera, dirty: false,
      selectedIds: [], selectedNodeId: null, clipboard: [], pending: null,
      openSettingsNodeId: null, openHandoff: null, hoveredHandoffKey: null,
      selectedLayerId: null, activeTabId: null,
    }),

  toggleSettings: (nodeId) =>
    set((s) => ({ openSettingsNodeId: s.openSettingsNodeId === nodeId ? null : nodeId })),

  toggleHandoff: (nodeId, key) =>
    set((s) => ({
      openHandoff:
        s.openHandoff && s.openHandoff.nodeId === nodeId && s.openHandoff.key === key
          ? null
          : { nodeId, key },
    })),

  setHoveredHandoff: (key) => set({ hoveredHandoffKey: key }),

  setMeta: (patch) =>
    set((s) => ({ project: s.project ? { ...s.project, ...patch } : s.project, dirty: true })),

  // Camera moves don't mark the doc dirty on their own — it's just viewport,
  // saved opportunistically alongside real edits.
  setCamera: (camera) => set({ camera }),

  setTool: (tool) => set({ tool }),

  addNode: (kind, x, y) => {
    const id = uuid();
    const { w, h, data } = nodeDefaults(kind);
    set((s) => {
      // Only one Start node is meaningful; ignore extra Start drops.
      if (kind === "start" && s.nodes.some((n) => n.kind === "start")) {
        return s;
      }
      return {
        nodes: [...s.nodes, { id, kind, x, y, w, h, data }],
        dirty: true,
        selectedIds: [id],
        selectedNodeId: id,
      };
    });
    return id;
  },

  updateNode: (id, patch) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
      dirty: true,
    })),

  updateNodeData: (id, patch) =>
    set((s) => {
      const nodes = s.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n));
      // Prune edges whose source port no longer exists after the change
      // (e.g. turning off a Question answer type removes that type's port).
      const changed = nodes.find((n) => n.id === id);
      let edges = s.edges;
      if (changed) {
        const validPorts = new Set(outputPorts(changed).map((p) => p.id));
        edges = s.edges.filter((e) => e.source_node_id !== id || validPorts.has(e.source_port));
      }
      return { nodes, edges, dirty: true };
    }),

  // Position updates during a drag fire a lot; keep them cheap and don't thrash
  // `dirty` until the pointer is released (the canvas calls updateNode on end).
  moveNode: (id, x, y) =>
    set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)) })),

  moveSelected: (dx, dy) =>
    set((s) => {
      if (!s.selectedIds.length) return s;
      const sel = new Set(s.selectedIds);
      return { nodes: s.nodes.map((n) => (sel.has(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n)) };
    }),

  removeNode: (id) =>
    set((s) => {
      const selectedIds = s.selectedIds.filter((sid) => sid !== id);
      return {
        nodes: s.nodes.filter((n) => n.id !== id),
        // Drop any edges touching the removed node.
        edges: s.edges.filter((e) => e.source_node_id !== id && e.target_node_id !== id),
        selectedIds,
        selectedNodeId: selectedIds.length === 1 ? selectedIds[0] : null,
        dirty: true,
      };
    }),

  selectNode: (id) => set({ selectedIds: id ? [id] : [], selectedNodeId: id }),

  setSelection: (ids, additive = false) =>
    set((s) => {
      const next = additive ? Array.from(new Set([...s.selectedIds, ...ids])) : ids;
      return { selectedIds: next, selectedNodeId: next.length === 1 ? next[0] : null };
    }),

  toggleSelected: (id) =>
    set((s) => {
      const next = s.selectedIds.includes(id)
        ? s.selectedIds.filter((sid) => sid !== id)
        : [...s.selectedIds, id];
      return { selectedIds: next, selectedNodeId: next.length === 1 ? next[0] : null };
    }),

  clearSelection: () => set({ selectedIds: [], selectedNodeId: null }),

  selectAll: () =>
    set((s) => {
      const ids = s.nodes.map((n) => n.id);
      return { selectedIds: ids, selectedNodeId: ids.length === 1 ? ids[0] : null };
    }),

  copySelection: () =>
    set((s) => {
      const sel = new Set(s.selectedIds);
      // Deep clone so later edits to the live nodes don't mutate the clipboard.
      const copied = s.nodes.filter((n) => sel.has(n.id)).map((n) => structuredClone(n));
      return { clipboard: copied };
    }),

  pasteClipboard: (offset = 32) =>
    set((s) => {
      if (!s.clipboard.length) return s;
      // Start nodes are singletons — never paste a second one.
      const source = s.clipboard.filter(
        (n) => n.kind !== "start" || !s.nodes.some((x) => x.kind === "start"),
      );
      if (!source.length) return s;
      // Fresh ids, remembering the mapping so edges *between* copied nodes survive.
      const idMap = new Map<string, string>();
      const clones = source.map((n) => {
        const id = uuid();
        idMap.set(n.id, id);
        return { ...structuredClone(n), id, x: n.x + offset, y: n.y + offset };
      });
      const innerEdges = s.edges
        .filter((e) => idMap.has(e.source_node_id) && idMap.has(e.target_node_id))
        .map((e) => ({
          ...e,
          id: uuid(),
          source_node_id: idMap.get(e.source_node_id)!,
          target_node_id: idMap.get(e.target_node_id)!,
        }));
      const ids = clones.map((n) => n.id);
      return {
        nodes: [...s.nodes, ...clones],
        edges: [...s.edges, ...innerEdges],
        selectedIds: ids,
        selectedNodeId: ids.length === 1 ? ids[0] : null,
        dirty: true,
      };
    }),

  duplicateSelection: () => {
    get().copySelection();
    get().pasteClipboard();
  },

  removeSelected: () =>
    set((s) => {
      if (!s.selectedIds.length) return s;
      const sel = new Set(s.selectedIds);
      return {
        nodes: s.nodes.filter((n) => !sel.has(n.id)),
        edges: s.edges.filter((e) => !sel.has(e.source_node_id) && !sel.has(e.target_node_id)),
        selectedIds: [],
        selectedNodeId: null,
        dirty: true,
      };
    }),

  addChoice: (nodeId) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, choices: [...(n.data.choices ?? []), DEFAULT_CHOICE("")] } }
          : n,
      ),
      dirty: true,
    })),

  updateChoice: (nodeId, choiceId, patch) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              data: {
                ...n.data,
                choices: (n.data.choices ?? []).map((c) => (c.id === choiceId ? { ...c, ...patch } : c)),
              },
            }
          : n,
      ),
      dirty: true,
    })),

  removeChoice: (nodeId, choiceId) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, choices: (n.data.choices ?? []).filter((c) => c.id !== choiceId) } }
          : n,
      ),
      // A choice port that no longer exists can't keep its edge.
      edges: s.edges.filter((e) => !(e.source_node_id === nodeId && e.source_port === choiceId)),
      dirty: true,
    })),

  addBox: (nodeId) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, boxes: [...(n.data.boxes ?? []), DEFAULT_BOX()] } } : n,
      ),
      dirty: true,
    })),

  updateBox: (nodeId, boxId, patch) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              data: {
                ...n.data,
                boxes: (n.data.boxes ?? []).map((b) => (b.id === boxId ? { ...b, ...patch } : b)),
              },
            }
          : n,
      ),
      dirty: true,
    })),

  removeBox: (nodeId, boxId) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, boxes: (n.data.boxes ?? []).filter((b) => b.id !== boxId) } }
          : n,
      ),
      edges: s.edges.filter((e) => !(e.source_node_id === nodeId && e.source_port === boxId)),
      dirty: true,
    })),

  // ── Placement ──────────────────────────────────────────────────────────────
  // Every action rewrites the whole `placement` object (it's a single jsonb
  // blob), reading through getPlacement — which also upgrades pre-tabs payloads,
  // so the first edit of an old node quietly migrates it.
  updatePlacement: (nodeId, patch) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, placement: { ...getPlacement(n.data), ...patch } } }
          : n,
      ),
      dirty: true,
    })),

  addPlacementTab: (nodeId, duplicateOf) => {
    const id = shortId();
    set((s) => ({
      nodes: s.nodes.map((n) => {
        if (n.id !== nodeId) return n;
        const p = getPlacement(n.data);
        const source = duplicateOf ? p.tabs.find((t) => t.id === duplicateOf) : undefined;
        // A duplicate carries the media and the whole overlay stack over, with
        // fresh layer ids so editing the copy can't reach back into the original.
        const tab: PlacementTab = source
          ? {
              id,
              name: `${source.name} copy`,
              media: source.media ? { ...source.media } : null,
              transform: { ...getTransform(source) },
              layers: source.layers.map((l) => ({ ...structuredClone(l), id: shortId() })),
            }
          : emptyTab(id, `Option ${p.tabs.length + 1}`);
        return { ...n, data: { ...n.data, placement: { ...p, tabs: [...p.tabs, tab] } } };
      }),
      activeTabId: id,
      selectedLayerId: null,
      dirty: true,
    }));
    return id;
  },

  updatePlacementTab: (nodeId, tabId, patch) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === nodeId ? patchTab(n, tabId, (t) => ({ ...t, ...patch })) : n)),
      dirty: true,
    })),

  removePlacementTab: (nodeId, tabId) =>
    set((s) => {
      let nextActive = s.activeTabId;
      const nodes = s.nodes.map((n) => {
        if (n.id !== nodeId) return n;
        const p = getPlacement(n.data);
        // Never leave a placement with zero options — the last tab stays put.
        if (p.tabs.length <= 1) return n;
        const tabs = p.tabs.filter((t) => t.id !== tabId);
        if (s.activeTabId === tabId) nextActive = tabs[0].id;
        return { ...n, data: { ...n.data, placement: { ...p, tabs } } };
      });
      return { nodes, activeTabId: nextActive, selectedLayerId: null, dirty: true };
    }),

  setActiveTab: (tabId) => set({ activeTabId: tabId, selectedLayerId: null }),

  addPlacementLayer: (nodeId, tabId, type, url, name) => {
    const id = shortId();
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId
          ? patchTab(n, tabId, (t) => ({
              ...t,
              layers: [
                ...t.layers,
                type === "text" ? defaultTextLayer(id) : defaultImageLayer(id, url ?? "", name),
              ],
            }))
          : n,
      ),
      selectedLayerId: id,
      dirty: true,
    }));
    return id;
  },

  updatePlacementLayer: (nodeId, tabId, layerId, patch) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId
          ? patchTab(n, tabId, (t) => ({
              ...t,
              layers: t.layers.map((l) => (l.id === layerId ? ({ ...l, ...patch } as PlacementLayer) : l)),
            }))
          : n,
      ),
      dirty: true,
    })),

  removePlacementLayer: (nodeId, tabId, layerId) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId
          ? patchTab(n, tabId, (t) => ({ ...t, layers: t.layers.filter((l) => l.id !== layerId) }))
          : n,
      ),
      selectedLayerId: s.selectedLayerId === layerId ? null : s.selectedLayerId,
      dirty: true,
    })),

  setSelectedLayer: (layerId) => set({ selectedLayerId: layerId }),

  addHandoffEffect: (nodeId, key) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId
          ? patchHandoff(n, key, (h) => ({ ...h, effects: [...h.effects, { id: shortId(), label: "", value: "" }] }))
          : n,
      ),
      dirty: true,
    })),

  updateHandoffEffect: (nodeId, key, effectId, patch) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId
          ? patchHandoff(n, key, (h) => ({
              ...h,
              effects: h.effects.map((fx) => (fx.id === effectId ? { ...fx, ...patch } : fx)),
            }))
          : n,
      ),
      dirty: true,
    })),

  removeHandoffEffect: (nodeId, key, effectId) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId
          ? patchHandoff(n, key, (h) => ({ ...h, effects: h.effects.filter((fx) => fx.id !== effectId) }))
          : n,
      ),
      dirty: true,
    })),

  setHandoffAttachment: (nodeId, key, att) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId ? patchHandoff(n, key, (h) => ({ ...h, attachment: att })) : n,
      ),
      dirty: true,
    })),

  addSettingCell: (nodeId) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, settings: [...(n.data.settings ?? []), { id: shortId(), label: "", value: "" }] } }
          : n,
      ),
      dirty: true,
    })),

  updateSettingCell: (nodeId, cellId, patch) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              data: {
                ...n.data,
                settings: (n.data.settings ?? []).map((c) => (c.id === cellId ? { ...c, ...patch } : c)),
              },
            }
          : n,
      ),
      dirty: true,
    })),

  removeSettingCell: (nodeId, cellId) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, settings: (n.data.settings ?? []).filter((c) => c.id !== cellId) } }
          : n,
      ),
      dirty: true,
    })),

  addAttachment: (nodeId, att) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, attachments: [...(n.data.attachments ?? []), att] } }
          : n,
      ),
      dirty: true,
    })),

  removeAttachment: (nodeId, attachmentId) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, attachments: (n.data.attachments ?? []).filter((a) => a.id !== attachmentId) } }
          : n,
      ),
      dirty: true,
    })),

  beginConnection: (sourceNodeId, sourcePort, x, y) =>
    set({ pending: { sourceNodeId, sourcePort, x, y } }),

  beginReconnect: (edgeId, x, y) =>
    set((s) => {
      const edge = s.edges.find((e) => e.id === edgeId);
      if (!edge) return s;
      // Lift the edge off: keep its origin as the pending source and drop the
      // stored edge so the live preview stands in for it. Dropping on empty
      // leaves it removed (unwire); dropping on an input recreates it.
      return {
        edges: s.edges.filter((e) => e.id !== edgeId),
        pending: {
          sourceNodeId: edge.source_node_id,
          sourcePort: edge.source_port,
          x,
          y,
          reconnectEdgeId: edgeId,
          detachedFrom: edge.target_node_id,
        },
        dirty: true,
      };
    }),

  markLeftDetach: () =>
    set((s) => (s.pending && !s.pending.hasLeftDetach ? { pending: { ...s.pending, hasLeftDetach: true } } : s)),

  updatePending: (x, y) =>
    set((s) => (s.pending ? { pending: { ...s.pending, x, y } } : s)),

  endConnection: (targetNodeId) => {
    const { pending, nodes } = get();
    if (!pending) return;
    if (!targetNodeId || targetNodeId === pending.sourceNodeId) {
      set({ pending: null });
      return;
    }
    // Reconnect gate: releasing back on the node we just detached from — before
    // the pointer ever left it — means "disconnect", so drop the edge (already
    // removed in beginReconnect) rather than re-creating it.
    if (targetNodeId === pending.detachedFrom && !pending.hasLeftDetach) {
      set({ pending: null });
      return;
    }
    const target = nodes.find((n) => n.id === targetNodeId);
    if (!target || !hasInputPort(target)) {
      set({ pending: null });
      return;
    }
    set((s) => {
      // One edge per (source, port): replace any existing edge from this port.
      const filtered = s.edges.filter(
        (e) => !(e.source_node_id === pending.sourceNodeId && e.source_port === pending.sourcePort),
      );
      return {
        edges: [
          ...filtered,
          {
            id: uuid(),
            source_node_id: pending.sourceNodeId,
            source_port: pending.sourcePort,
            target_node_id: targetNodeId,
            target_port: "in",
            label: null,
          },
        ],
        pending: null,
        dirty: true,
      };
    });
  },

  cancelConnection: () => set({ pending: null }),

  removeEdge: (id) =>
    set((s) => ({ edges: s.edges.filter((e) => e.id !== id), dirty: true })),

  markClean: () => set({ dirty: false }),
}));
