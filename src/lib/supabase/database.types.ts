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
    };
    Enums: {
      question_kind: "choice" | "like" | "answer" | "message";
      media_kind: "image" | "gif" | "video" | "text";
      plan_tier: "free" | "pro" | "studio";
      review_asset_kind: ReviewAssetKind;
      review_asset_status: ReviewAssetStatus;
      comment_status: CommentStatus;
      annotation_type: AnnotationType;
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
