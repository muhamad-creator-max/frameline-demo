// AUTO-GENERATED placeholder. Regenerate with:
//   npm run db:types
//
// Until you run that against your Supabase project, types are loosely typed to
// keep the rest of the codebase compiling.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  // Marker the newer @supabase/postgrest-js reads to resolve schema generics.
  // Without it, table types can collapse to `never`. Mirrors what
  // `supabase gen types` emits.
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          locale: "en" | "ar";
          plan: "free" | "pro" | "studio";
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & { id: string; email: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      guidelines: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          description: string | null;
          cover_color: string;
          status: "draft" | "published" | "archived";
          share_slug: string | null;
          password_hash: string | null;
          one_question_per_screen: boolean;
          ready_to_go: boolean;
          current_version: number;
          view_count: number;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["guidelines"]["Row"]> & { owner_id: string };
        Update: Partial<Database["public"]["Tables"]["guidelines"]["Row"]>;
        Relationships: [];
      };
      questions: {
        Row: {
          id: string;
          guideline_id: string;
          position: number;
          kind: "choice" | "like" | "answer" | "message";
          title: string;
          helper: string | null;
          required: boolean;
          allow_comment: boolean;
          settings: SettingCell[];
          attachments: Attachment[];
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["questions"]["Row"]> & {
          guideline_id: string;
          position: number;
          kind: "choice" | "like" | "answer" | "message";
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["questions"]["Row"]>;
        Relationships: [];
      };
      options: {
        Row: {
          id: string;
          question_id: string;
          position: number;
          label: string | null;
          media_kind: "image" | "gif" | "video" | "text";
          media_url: string | null;
          media_provider: "bunny" | "mux" | "external" | null;
          media_meta: Json;
          settings: SettingCell[];
          attachments: Attachment[];
          reveal_question_ids: string[];
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["options"]["Row"]> & {
          question_id: string;
          position: number;
        };
        Update: Partial<Database["public"]["Tables"]["options"]["Row"]>;
        Relationships: [];
      };
      guideline_snapshots: {
        Row: {
          id: string;
          guideline_id: string;
          version: number;
          payload: GuidelineSnapshotPayload;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["guideline_snapshots"]["Row"], "id" | "created_at"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["guideline_snapshots"]["Row"]>;
        Relationships: [];
      };
      responses: {
        Row: {
          id: string;
          guideline_id: string;
          snapshot_id: string;
          client_name: string;
          client_email: string | null;
          user_agent: string | null;
          ip_hash: string | null;
          status: "in_progress" | "submitted";
          started_at: string;
          submitted_at: string | null;
          duration_ms: number | null;
        };
        Insert: Partial<Database["public"]["Tables"]["responses"]["Row"]> & {
          guideline_id: string;
          snapshot_id: string;
          client_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["responses"]["Row"]>;
        Relationships: [];
      };
      answers: {
        Row: {
          id: string;
          response_id: string;
          question_id: string;
          selected_option_ids: string[] | null;
          liked: boolean | null;
          text_value: string | null;
          comment_text: string | null;
          comment_attachments: Attachment[];
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["answers"]["Row"]> & {
          response_id: string;
          question_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["answers"]["Row"]>;
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          stripe_price_id: string | null;
          plan: "free" | "pro" | "studio";
          status:
            | "trialing"
            | "active"
            | "canceled"
            | "past_due"
            | "incomplete"
            | "incomplete_expired"
            | "unpaid"
            | "paused";
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["subscriptions"]["Row"]> & { user_id: string };
        Update: Partial<Database["public"]["Tables"]["subscriptions"]["Row"]>;
        Relationships: [];
      };

      // ───── Video Review (Frame.io-style) ─────
      review_projects: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          description: string | null;
          share_slug: string | null;
          password_hash: string | null;
          allow_download: boolean;
          view_count: number;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["review_projects"]["Row"]> & { owner_id: string };
        Update: Partial<Database["public"]["Tables"]["review_projects"]["Row"]>;
        Relationships: [];
      };
      review_folders: {
        Row: {
          id: string;
          project_id: string;
          parent_id: string | null;
          name: string;
          position: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["review_folders"]["Row"]> & { project_id: string };
        Update: Partial<Database["public"]["Tables"]["review_folders"]["Row"]>;
        Relationships: [];
      };
      review_assets: {
        Row: {
          id: string;
          project_id: string;
          folder_id: string | null;
          kind: ReviewAssetKind;
          name: string;
          current_version: number;
          position: number;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["review_assets"]["Row"]> & {
          project_id: string;
          kind: ReviewAssetKind;
        };
        Update: Partial<Database["public"]["Tables"]["review_assets"]["Row"]>;
        Relationships: [];
      };
      review_asset_versions: {
        Row: {
          id: string;
          asset_id: string;
          version: number;
          status: ReviewAssetStatus;
          provider: "mux" | "bunny" | "storage";
          mux_upload_id: string | null;
          mux_asset_id: string | null;
          mux_playback_id: string | null;
          file_url: string | null;
          duration_s: number | null;
          aspect_ratio: string | null;
          width: number | null;
          height: number | null;
          thumbnail_url: string | null;
          size_bytes: number | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["review_asset_versions"]["Row"]> & {
          asset_id: string;
          version: number;
        };
        Update: Partial<Database["public"]["Tables"]["review_asset_versions"]["Row"]>;
        Relationships: [];
      };
      review_comments: {
        Row: {
          id: string;
          asset_id: string;
          version_id: string;
          parent_id: string | null;
          author_profile_id: string | null;
          author_guest_name: string | null;
          author_guest_token: string | null;
          body: string;
          timestamp_seconds: number | null;
          status: CommentStatus;
          resolved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["review_comments"]["Row"]> & {
          asset_id: string;
          version_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["review_comments"]["Row"]>;
        Relationships: [];
      };
      annotations: {
        Row: {
          id: string;
          comment_id: string;
          version_id: string;
          asset_id: string;
          timestamp_seconds: number;
          type: AnnotationType;
          coordinates_json: AnnotationCoordinates;
          color: string;
          stroke_width: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["annotations"]["Row"]> & {
          comment_id: string;
          version_id: string;
          asset_id: string;
          timestamp_seconds: number;
          type: AnnotationType;
        };
        Update: Partial<Database["public"]["Tables"]["annotations"]["Row"]>;
        Relationships: [];
      };
      workflow_projects: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          description: string | null;
          share_slug: string | null;
          password_hash: string | null;
          canvas: WorkflowCanvasState;
          status: WorkflowStatus;
          current_version: number;
          view_count: number;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["workflow_projects"]["Row"]> & { owner_id: string };
        Update: Partial<Database["public"]["Tables"]["workflow_projects"]["Row"]>;
        Relationships: [];
      };
      workflow_nodes: {
        Row: {
          id: string;
          project_id: string;
          kind: WorkflowNodeKind;
          x: number;
          y: number;
          w: number;
          h: number;
          data: WorkflowNodeData;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["workflow_nodes"]["Row"]> & {
          project_id: string;
          kind: WorkflowNodeKind;
        };
        Update: Partial<Database["public"]["Tables"]["workflow_nodes"]["Row"]>;
        Relationships: [];
      };
      workflow_edges: {
        Row: {
          id: string;
          project_id: string;
          source_node_id: string;
          source_port: string;
          target_node_id: string;
          target_port: string;
          label: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["workflow_edges"]["Row"]> & {
          project_id: string;
          source_node_id: string;
          target_node_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["workflow_edges"]["Row"]>;
        Relationships: [];
      };
      workflow_snapshots: {
        Row: {
          id: string;
          project_id: string;
          version: number;
          payload: WorkflowSnapshotPayload;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["workflow_snapshots"]["Row"], "id" | "created_at"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["workflow_snapshots"]["Row"]>;
        Relationships: [];
      };
      workflow_responses: {
        Row: {
          id: string;
          project_id: string;
          snapshot_id: string;
          client_name: string;
          client_email: string | null;
          user_agent: string | null;
          ip_hash: string | null;
          path: string[];
          status: "in_progress" | "submitted";
          started_at: string;
          submitted_at: string | null;
          duration_ms: number | null;
          deleted_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["workflow_responses"]["Row"]> & {
          project_id: string;
          snapshot_id: string;
          client_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["workflow_responses"]["Row"]>;
        Relationships: [];
      };
      workflow_answers: {
        Row: {
          id: string;
          response_id: string;
          node_id: string;
          kind: WorkflowNodeKind;
          value: WorkflowAnswerValue;
          comment_text: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["workflow_answers"]["Row"]> & {
          response_id: string;
          node_id: string;
          kind: WorkflowNodeKind;
        };
        Update: Partial<Database["public"]["Tables"]["workflow_answers"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      increment_guideline_views: {
        Args: { p_slug: string };
        Returns: undefined;
      };
      increment_review_views: {
        Args: { p_slug: string };
        Returns: undefined;
      };
      increment_workflow_views: {
        Args: { p_slug: string };
        Returns: undefined;
      };
    };
    Enums: {
      question_kind: "choice" | "like" | "answer" | "message";
      media_kind: "image" | "gif" | "video" | "text";
      plan_tier: "free" | "pro" | "studio";
      review_asset_kind: ReviewAssetKind;
      review_asset_status: ReviewAssetStatus;
      comment_status: CommentStatus;
      annotation_type: AnnotationType;
      workflow_node_kind: WorkflowNodeKind;
      workflow_status: WorkflowStatus;
      workflow_response_status: "in_progress" | "submitted";
    };
    CompositeTypes: Record<string, never>;
  };
}

// ───── video review domain types ─────
export type ReviewAssetKind = "video" | "image" | "audio";
export type ReviewAssetStatus = "uploading" | "processing" | "ready" | "errored";
export type CommentStatus = "open" | "in_progress" | "done";
export type AnnotationType = "arrow" | "rect" | "ellipse" | "freehand" | "text";

/**
 * Annotation geometry — all values are 0..1 percentages of the media box so
 * drawings stay aligned on any screen size. Fields populated depend on `type`:
 *   arrow    → x, y, endX, endY
 *   rect     → x, y, w, h
 *   ellipse  → x, y, w, h   (x,y = top-left of bounding box)
 *   freehand → points: [x0, y0, x1, y1, …]  (flattened, normalized)
 *   text     → x, y, text, fontSize (fraction of media height)
 */
export interface AnnotationCoordinates {
  x?: number;
  y?: number;
  endX?: number;
  endY?: number;
  w?: number;
  h?: number;
  points?: number[];
  text?: string;
  fontSize?: number;
}

// ───── domain types reused across the app ─────
export interface SettingCell {
  id: string;
  label: string;
  value: string;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  kind: "image" | "gif" | "video" | "lut" | "preset" | "file";
  size?: number;
  provider?: "bunny" | "mux" | "external";
}

export interface GuidelineSnapshotPayload {
  title: string;
  description: string | null;
  cover_color: string;
  one_question_per_screen: boolean;
  ready_to_go: boolean;
  questions: Array<{
    id: string;
    kind: "choice" | "like" | "answer" | "message";
    title: string;
    helper: string | null;
    required: boolean;
    allow_comment: boolean;
    settings: SettingCell[];
    attachments: Attachment[];
    options: Array<{
      id: string;
      label: string | null;
      media_kind: "image" | "gif" | "video" | "text";
      media_url: string | null;
      media_provider: "bunny" | "mux" | "external" | null;
      media_meta: Record<string, unknown>;
      settings: SettingCell[];
      attachments: Attachment[];
      reveal_question_ids: string[];
    }>;
  }>;
}

// ───── workflows domain types ─────
export type WorkflowNodeKind = "start" | "question" | "choice" | "identity" | "note" | "placement";
export type WorkflowStatus = "draft" | "published" | "archived";

/** Persisted canvas viewport so the editor reopens where the user left off. */
export interface WorkflowCanvasState {
  x: number;
  y: number;
  zoom: number;
}

/** The five answer channels a Question node can collect. */
export interface QuestionAnswerConfig {
  text: boolean;
  image: boolean;
  video: boolean;
  link: boolean;
  file: boolean;
}

/** One selectable choice on a Choice node (text / image / video). */
export interface WorkflowChoice {
  id: string;
  label: string;
  media_kind: "image" | "gif" | "video" | "text";
  media_url: string | null;
  media_provider: "bunny" | "mux" | "external" | null;
  media_meta: Record<string, unknown>;
}

/** One styled mini-box on an Identity node (color swatch + caption). */
export interface IdentityBox {
  id: string;
  bg: string;               // background color code
  text: string;             // caption in the middle
  font: string;             // Google font family name
  lang: string;             // font subset/language for the picker filter
  color: string;            // text color
  textBg: string;           // text background (behind the caption)
  shadow: string;           // css box-shadow value ("" = none)
  radius: number;           // rounded-box radius in px
}

// ── Placement node ──
// A base image/video with text + image overlays composited on top, so the client
// can see exactly where a caption or logo is meant to sit. Every geometric value
// is RELATIVE (percent), never px: the same config renders identically in the
// small editor card and the full-size client screen.

/** What the client sends back after seeing the placement preview. */
export type PlacementRespondType = "text" | "media" | "link";

export type PlacementBlendMode =
  | "normal" | "multiply" | "screen" | "overlay" | "darken" | "lighten"
  | "color-dodge" | "color-burn" | "hard-light" | "soft-light"
  | "difference" | "exclusion" | "hue" | "saturation" | "color" | "luminosity";

/**
 * Framing transform for a tab's background media. `scale: 100` fills the frame
 * (the media is object-fit: cover); x/y are % of the stage, so the framing holds
 * at any preview size.
 */
export interface PlacementTransform {
  scale: number;
  x: number;
  y: number;
  rotation: number;
}

/** The base media the overlays sit on. */
export interface PlacementMedia {
  url: string;
  kind: "image" | "video";
  name?: string;
  /** Natural pixel size, used to derive the stage aspect on upload. */
  width?: number;
  height?: number;
  provider?: "bunny" | "external";
}

/** Fields shared by every overlay layer. Positions are % of the stage. */
interface PlacementLayerBase {
  id: string;
  /** Layer centre, 0–100 % of stage width / height. */
  x: number;
  y: number;
  /** Clockwise rotation in degrees. */
  rotation: number;
  hidden?: boolean;
}

/**
 * A text overlay (caption / lower-third). `size` is a % of stage height, and the
 * shadow offsets + background radius are % of the font size — all resolution
 * independent, so the preview matches the client's screen at any scale.
 */
export interface PlacementTextLayer extends PlacementLayerBase {
  type: "text";
  text: string;
  font: string;           // Google font family
  lang: string;           // font subset for the picker filter
  weight: number;         // 100–900
  size: number;           // % of stage height
  color: string;
  /**
   * Explicit text box, set by dragging the corner handles. Both absent = the box
   * hugs the text (and wraps at 88% of the stage). % of stage width / height.
   */
  boxW?: number;
  boxH?: number;
  /** Drop shadow behind the glyphs; x/y/blur are % of the font size. */
  shadow: { on: boolean; x: number; y: number; blur: number; color: string };
  /** Plate behind the text; radius is % of the font size. */
  bg: { on: boolean; color: string; radius: number };
}

/** An image overlay (logo / watermark). `scale` is a % of stage width. */
export interface PlacementImageLayer extends PlacementLayerBase {
  type: "image";
  url: string;
  name?: string;
  scale: number;
  blend: PlacementBlendMode;
  opacity: number;        // 0–100
}

export type PlacementLayer = PlacementTextLayer | PlacementImageLayer;

/**
 * One placement OPTION. A node holds several as tabs, so the client can compare
 * treatments (same logo bottom-left vs. top-right, two caption styles…) and pick
 * one. Each tab owns its background media and its overlay stack; the frame ratio
 * is shared by the node so the options stay comparable.
 */
export interface PlacementTab {
  id: string;
  name: string;
  media: PlacementMedia | null;
  /** How the background is framed. Absent = untransformed (see DEFAULT_TRANSFORM). */
  transform?: PlacementTransform;
  layers: PlacementLayer[];
}

export interface PlacementConfig {
  tabs: PlacementTab[];
  /** Stage aspect ratio (width / height), shared by every tab. */
  aspect: number;
  respond: PlacementRespondType;
  /** @deprecated pre-tabs payload — `getPlacement()` folds these into tabs[0]. */
  media?: PlacementMedia | null;
  /** @deprecated pre-tabs payload — see `media`. */
  layers?: PlacementLayer[];
}

/**
 * Per-kind node payload (jsonb). A discriminated shape kept loose on the DB
 * boundary; the Zustand store narrows it per kind. Editor Hand-off cells +
 * attachments live on every node under `settings` / `attachments`.
 */
/**
 * Per-option editor hand-off (design model): each answer-type row / choice / box
 * / note-output carries its own effect cells + a single attachment, keyed by an
 * option key (e.g. `text`, a choice id, a box id, or `note`). Shown to the editor
 * assistant, hidden from the client.
 */
export interface WorkflowOptionHandoff {
  effects: SettingCell[];
  attachment: Attachment | null;
}

export interface WorkflowNodeData {
  // shared — legacy node-level hand-off (kept for back-compat with earlier nodes)
  settings?: SettingCell[];
  attachments?: Attachment[];
  /** Per-option hand-off, keyed by option key. The design's primary hand-off model. */
  option_handoffs?: Record<string, WorkflowOptionHandoff>;
  // start
  label?: string;
  // question / choice / identity
  title?: string;
  helper?: string;
  // question
  answer?: QuestionAnswerConfig;
  required?: boolean;
  // choice
  choices?: WorkflowChoice[];
  // choice / identity
  max_answers?: number;
  // identity
  boxes?: IdentityBox[];
  // note
  text?: string;
  // placement
  placement?: PlacementConfig;
}

export interface WorkflowSnapshotPayload {
  title: string;
  description: string | null;
  canvas: WorkflowCanvasState;
  nodes: Array<{
    id: string;
    kind: WorkflowNodeKind;
    x: number;
    y: number;
    w: number;
    h: number;
    data: WorkflowNodeData;
  }>;
  edges: Array<{
    id: string;
    source_node_id: string;
    source_port: string;
    target_node_id: string;
    target_port: string;
    label: string | null;
  }>;
}

/** A client-uploaded file attached to a Question answer. */
export interface WorkflowAnswerFile {
  id: string;
  name: string;
  url: string;
  kind: string;
  size?: number;
}

/**
 * The client's answer to a single node, shape depends on the node kind:
 *   question → { text?, link?, files? }
 *   choice   → { selected: choiceId[] }
 *   identity → { selected: boxId[] }
 *   note     → {}
 */
export interface WorkflowAnswerValue {
  text?: string;
  link?: string;
  files?: WorkflowAnswerFile[];
  selected?: string[];
}
