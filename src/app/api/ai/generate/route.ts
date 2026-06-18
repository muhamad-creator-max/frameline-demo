import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { newShareSlug } from "@/lib/utils";

export const runtime = "nodejs";

/**
 * POST /api/ai/generate
 *   Body: { prompt: string, locale?: "en" | "ar" }
 *
 * Calls Anthropic Claude to plan a Frameline guideline, then creates the
 * guideline + questions + options in the DB. Returns the new guideline id
 * so the UI can navigate straight into the builder.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI is not configured. Add ANTHROPIC_API_KEY to your .env.local" },
      { status: 503 },
    );
  }

  const { prompt, locale } = (await req.json()) as { prompt?: string; locale?: "en" | "ar" };
  if (!prompt || prompt.trim().length < 4) {
    return NextResponse.json({ error: "Prompt too short" }, { status: 400 });
  }

  const system = [
    "You are Frameline's Guideline Architect. You design visual creative briefs",
    "for video editors to send to clients before they start editing.",
    "",
    "Return STRICT JSON matching this schema (no prose, no markdown fences):",
    "{",
    '  "title": string,                    // brief title in user\'s language',
    '  "description": string,              // 1-2 sentences',
    '  "questions": [{',
    '    "kind": "choice" | "like" | "answer" | "message",',
    '    "title": string,                  // the question or chapter text',
    '    "helper"?: string,                // optional helper/instruction',
    '    "options"?: [{                    // for choice + like only',
    '      "label": string,',
    '      "media_kind": "text" | "image" | "video"',
    '    }]',
    "  }]",
    "}",
    "",
    'Use "message" kind for chapters/sections between groups of questions (e.g. "Now let\'s look at color grading"). They have no options.',
    'Use "choice" for picking between visual options (2-4 options, prefer image media_kind).',
    'Use "like" for a single yes/no on a single visual.',
    'Use "answer" for free-text creative direction.',
    "Aim for 6-12 questions. Mix the kinds. Be specific and concrete.",
    locale === "ar"
      ? "The user is Arabic-speaking. Write the title, description, questions, helpers, and option labels IN ARABIC."
      : "Write everything in clear English.",
  ].join("\n");

  let json: GeneratedGuideline;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-7",
        max_tokens: 4096,
        system,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[ai/generate] anthropic error", res.status, detail);
      return NextResponse.json(
        { error: `Anthropic ${res.status}: ${detail.slice(0, 200)}` },
        { status: 502 },
      );
    }
    const data = await res.json();
    const text = data?.content?.[0]?.text;
    json = parseLooseJson(text);
  } catch (e) {
    console.error("[ai/generate] network", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI call failed" },
      { status: 502 },
    );
  }

  if (!json?.title || !Array.isArray(json.questions)) {
    return NextResponse.json({ error: "Model returned unusable response" }, { status: 502 });
  }

  // Persist the generated guideline using the admin client.
  const admin = createAdminClient();
  const { data: gl, error: glErr } = await admin
    .from("guidelines")
    .insert({
      owner_id: user.id,
      title: json.title.slice(0, 200),
      description: (json.description ?? "").slice(0, 600),
      share_slug: newShareSlug(),
      status: "draft",
      current_version: 0,
    })
    .select("id")
    .single();
  if (glErr || !gl) {
    return NextResponse.json({ error: glErr?.message ?? "create failed" }, { status: 500 });
  }

  for (let i = 0; i < json.questions.length; i++) {
    const q = json.questions[i];
    if (!q?.kind || !q?.title) continue;
    const kind = ["choice", "like", "answer", "message"].includes(q.kind) ? q.kind : "answer";
    const questionId = crypto.randomUUID();
    await admin.from("questions").insert({
      id: questionId,
      guideline_id: gl.id,
      position: i,
      kind: kind as never,
      title: q.title.slice(0, 500),
      helper: q.helper ? q.helper.slice(0, 400) : null,
      required: true,
      allow_comment: kind !== "message",
    });
    if ((kind === "choice" || kind === "like") && Array.isArray(q.options)) {
      const opts = q.options.slice(0, 4);
      for (let j = 0; j < opts.length; j++) {
        const o = opts[j];
        if (!o?.label) continue;
        const mediaKind = ["text", "image", "video", "gif"].includes(o.media_kind ?? "")
          ? o.media_kind
          : "text";
        await admin.from("options").insert({
          question_id: questionId,
          position: j,
          label: o.label.slice(0, 160),
          media_kind: mediaKind as never,
          media_url: null,
          media_provider: null,
        });
      }
    }
  }

  return NextResponse.json({ id: gl.id });
}

interface GeneratedGuideline {
  title: string;
  description?: string;
  questions: Array<{
    kind: "choice" | "like" | "answer" | "message";
    title: string;
    helper?: string;
    options?: Array<{ label: string; media_kind?: "text" | "image" | "video" | "gif" }>;
  }>;
}

/** Strip optional ```json fences and parse. */
function parseLooseJson(raw: unknown): GeneratedGuideline {
  if (typeof raw !== "string") return raw as GeneratedGuideline;
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  return JSON.parse(stripped);
}
