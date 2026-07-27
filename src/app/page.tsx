import Link from "next/link";
import { ArrowRight, Layers3, MessageSquareText, Palette, Sparkles, Wand2, Workflow } from "lucide-react";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { FrameMark } from "@/components/brand/frame-mark";

/**
 * Landing page in the Canvas Workspace identity: dotted field, zinc neutrals,
 * JetBrains-Mono meta text, near-black primary action, 16px cards.
 */
export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden" style={{ background: "var(--canvas)" }}>
      {/* The canvas dotted field, faded out toward the bottom. */}
      <div
        className="workflow-dots pointer-events-none absolute inset-0"
        aria-hidden
        style={{ maskImage: "linear-gradient(to bottom, black 0%, transparent 70%)", WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 70%)" }}
      />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/"><FrameMark /></Link>
        <nav className="flex items-center gap-2">
          <ThemeSwitcher />
          <Link href="/login" className="cv-btn">Sign in</Link>
          <Link href="/signup" className="cv-btn-primary">Get started</Link>
        </nav>
      </header>

      <section className="relative z-10 mx-auto max-w-4xl px-6 pt-20 pb-24 text-center">
        <div
          className="cv-meta mx-auto mb-7 inline-flex items-center gap-2 rounded-full px-3 py-1.5"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border-raw)",
            color: "var(--text-3)",
            fontSize: 10,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--success)" }} />
          Visual creative alignment for editors
        </div>

        <h1
          className="text-balance text-5xl leading-[1.05] md:text-6xl"
          style={{ color: "var(--text)", fontWeight: 600, letterSpacing: "-0.03em" }}
        >
          Stop guessing what your client wants.
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg" style={{ color: "var(--text-2)" }}>
          Build interactive visual briefs on a canvas. Connect questions into a flow, send one link,
          and get back a structured creative direction your editor can actually use — references,
          settings, LUTs, and all.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link href="/signup" className="cv-btn-primary" style={{ padding: "11px 20px", fontSize: 12 }}>
            Start for free <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="#features" className="cv-btn" style={{ padding: "11px 20px", fontSize: 12 }}>
            See how it works
          </Link>
        </div>
      </section>

      <section id="features" className="relative z-10 mx-auto grid max-w-6xl gap-4 px-6 pb-32 md:grid-cols-3">
        <FeatureCard
          icon={<Workflow />}
          accent="oklch(0.55 0.19 265)"
          soft="oklch(0.96 0.02 265)"
          title="Flows on a canvas"
          body="Drag question, choice, identity and note nodes onto an infinite canvas and wire them together. Different answers branch to different questions."
        />
        <FeatureCard
          icon={<Palette />}
          accent="oklch(0.55 0.19 310)"
          soft="oklch(0.96 0.02 310)"
          title="Visual, not verbal"
          body="Show options. Let clients pick the look — images, clips, styled type. No more vague Slack threads."
        />
        <FeatureCard
          icon={<Wand2 />}
          accent="oklch(0.68 0.16 70)"
          soft="oklch(0.96 0.03 70)"
          title="Editor hand-off, attached"
          body="Wire each answer to LUTs, presets and value cells. Your editor opens the response and knows exactly how to recreate the look."
        />
        <FeatureCard
          icon={<MessageSquareText />}
          accent="oklch(0.58 0.13 170)"
          soft="oklch(0.96 0.02 170)"
          title="Composer-style answers"
          body="Every question has a composer — clients can riff, paste links, and drop reference files, just like the chat they already use."
        />
        <FeatureCard
          icon={<Layers3 />}
          accent="oklch(0.55 0.19 265)"
          soft="oklch(0.96 0.02 265)"
          title="Snapshot versioning"
          body="When you publish a link, the brief is frozen. Keep editing safely while in-flight responses stay consistent."
        />
        <FeatureCard
          icon={<Sparkles />}
          accent="oklch(0.58 0.13 170)"
          soft="oklch(0.96 0.02 170)"
          title="Dark mode + RTL"
          body="Deep zinc neutrals for late-night edit sessions, and full right-to-left support with mirrored chrome."
        />
      </section>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  body,
  accent,
  soft,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  accent: string;
  soft: string;
}) {
  return (
    <div className="cv-card flex flex-col gap-3 p-6">
      <div
        className="flex h-10 w-10 items-center justify-center"
        style={{ borderRadius: 12, background: soft, color: accent }}
      >
        {icon}
      </div>
      <h3 className="display-title" style={{ ["--display-title-size" as string]: "13px", color: "var(--text)" }}>
        {title}
      </h3>
      <p className="text-sm" style={{ color: "var(--text-2)", lineHeight: 1.6 }}>{body}</p>
    </div>
  );
}
