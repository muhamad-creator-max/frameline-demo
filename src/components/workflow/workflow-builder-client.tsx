"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import type {
  WorkflowProject,
  WorkflowNode,
  WorkflowEdge,
} from "@/lib/workflow/store";
import type { WorkflowCanvasState } from "@/lib/supabase/database.types";

// Konva touches `window`, so the whole builder is client-only (no SSR).
const WorkflowBuilder = dynamic(
  () => import("./workflow-builder").then((m) => m.WorkflowBuilder),
  {
    ssr: false,
    loading: () => (
      <div style={{ height: "100%", display: "grid", placeItems: "center", color: "var(--text-3)" }}>
        <Loader2 className="animate-spin" size={22} />
      </div>
    ),
  },
);

export function WorkflowBuilderClient(props: {
  project: WorkflowProject;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  canvas: WorkflowCanvasState;
}) {
  return <WorkflowBuilder {...props} />;
}
