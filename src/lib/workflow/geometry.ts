import type { WorkflowNode } from "./store";
import { outputPorts } from "./store";
import {
  PLACEMENT_CARD_W,
  PLACEMENT_TABS_H,
  PLACEMENT_TITLE_H,
  cardStageH,
  getPlacement,
} from "./placement";

/**
 * Card + row geometry, matching the Canvas Workflow Builder design exactly so
 * HTML rows and their port dots line up. All values in world (pre-zoom) px.
 */
export const CARD_W = 300;
export const HEADER_H = 48;
export const TEXT_BLOCK_H = 64; // question/choice textarea block
export const ROW_H = 40; // question answer rows + choice rows
export const BOX_ROW_H = 56; // identity box rows
export const NOTE_BODY_H = 130;
export const INPUT_PORT_Y = 24; // input dot vertical offset from card top

/**
 * Rendered width of a card. Every kind uses the design's 300px except Placement,
 * which is wider so its preview stage + tools fit. Anything that measures a card
 * (port X, marquee hit-test) must go through this, not CARD_W.
 */
export function cardWidth(node: WorkflowNode): number {
  return cardWidthForKind(node.kind);
}

/** Same as `cardWidth`, for callers that only have a kind (toolbar drop maths). */
export function cardWidthForKind(kind: WorkflowNode["kind"]): number {
  return kind === "placement" ? PLACEMENT_CARD_W : CARD_W;
}

/** World position of a node's input port (left edge). */
export function inputPortPos(node: WorkflowNode) {
  return { x: node.x, y: node.y + INPUT_PORT_Y };
}

/**
 * World Y (relative to card top) of output port index `i`, matching each node
 * type's row layout. Used by both the canvas (dot placement) and edge routing.
 */
export function outputPortY(node: WorkflowNode, index: number): number {
  switch (node.kind) {
    case "note":
      return HEADER_H + NOTE_BODY_H / 2;
    case "identity":
      return HEADER_H + index * BOX_ROW_H + BOX_ROW_H / 2;
    case "start":
      return HEADER_H / 2;
    case "placement":
      // Single port, centred on the preview stage. The stage sits under the
      // prompt + the option-tab strip and its height follows the frame ratio.
      return HEADER_H + PLACEMENT_TITLE_H + PLACEMENT_TABS_H + cardStageH(getPlacement(node.data)) / 2;
    case "question":
    case "choice":
    default:
      return HEADER_H + TEXT_BLOCK_H + index * ROW_H + ROW_H / 2;
  }
}

/** World position of output port index `i` (right edge of the card). */
export function outputPortPos(node: WorkflowNode, index: number) {
  return { x: node.x + cardWidth(node), y: node.y + outputPortY(node, index) };
}

/** Find the output port index for a given port id, or -1. */
export function portIndex(node: WorkflowNode, portId: string): number {
  return outputPorts(node).findIndex((p) => p.id === portId);
}

/** Cubic-bezier path string between two world points (design's curve). */
export function edgePath(x1: number, y1: number, x2: number, y2: number): string {
  return `M${x1},${y1} C${x1 + 80},${y1} ${x2 - 80},${y2} ${x2},${y2}`;
}

/**
 * Approximate rendered height of a card, derived from its row layout (the same
 * constants the bodies use). Good enough for hit-testing a marquee against a
 * node; exact pixel height also depends on the settings accordion.
 */
export function nodeHeight(node: WorkflowNode): number {
  const ports = outputPorts(node).length;
  switch (node.kind) {
    case "start":
      return HEADER_H;
    case "note":
      return HEADER_H + NOTE_BODY_H;
    case "identity":
      return HEADER_H + Math.max(1, ports) * BOX_ROW_H + ROW_H;
    case "placement":
      // Header + prompt + tabs + stage + the tool strips below it (the layer
      // tools panel expands past this; approximate is fine for marquee hits).
      return (
        HEADER_H + PLACEMENT_TITLE_H + PLACEMENT_TABS_H +
        cardStageH(getPlacement(node.data)) + ROW_H * 3
      );
    default: // question / choice
      return HEADER_H + TEXT_BLOCK_H + Math.max(1, ports) * ROW_H + ROW_H;
  }
}

/** Screen-px snap radius for wire magnetism (callers divide by zoom to get world px). */
export const SNAP_RADIUS = 46;

/**
 * Nearest connectable input port to a world point, within SNAP_RADIUS, skipping
 * `excludeNodeId` (the connection's own source). Returns the node id + the port's
 * world position so the live wire can snap to it, or null when nothing is close.
 */
export function nearestInput(
  point: { x: number; y: number },
  nodes: WorkflowNode[],
  excludeNodeId: string | null,
  radius = SNAP_RADIUS,
): { nodeId: string; pos: { x: number; y: number } } | null {
  let best: { nodeId: string; pos: { x: number; y: number } } | null = null;
  let bestD = radius * radius;
  for (const n of nodes) {
    if (n.kind === "start") continue; // Start has no input
    if (n.id === excludeNodeId) continue;
    const p = inputPortPos(n);
    const dx = p.x - point.x;
    const dy = p.y - point.y;
    const d = dx * dx + dy * dy;
    if (d <= bestD) {
      bestD = d;
      best = { nodeId: n.id, pos: p };
    }
  }
  return best;
}
