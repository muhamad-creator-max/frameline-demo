import Link from "next/link";
import { ArrowRight, Layers3, MessageSquareText, Palette, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { FrameMark } from "@/components/brand/frame-mark";

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-50" aria-hidden />
      <div className="absolute left-1/2 top-[-15%] -z-10 h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-primary/15 blur-[120px] dark:bg-primary/25" />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/"><FrameMark /></Link>
        <nav className="flex items-center gap-2">
          <LocaleSwitcher />
          <ThemeSwitcher />
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/signup">Get started</Link>
          </Button>
        </nav>
      </header>

      <section className="relative z-10 mx-auto max-w-4xl px-6 pt-16 pb-24 text-center">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Visual creative alignment for editors
        </div>
        <h1 className="text-balance text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
          Stop guessing what your{" "}
          <span className="bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">
            client wants
          </span>
          .
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
          Build interactive visual briefs in minutes. Send a link. Get back a structured creative
          direction your editor can actually use — references, settings, LUTs, and all.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/signup">
              Start for free <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href="#features">See how it works</Link>
          </Button>
        </div>
      </section>

      <section id="features" className="relative z-10 mx-auto grid max-w-6xl gap-4 px-6 pb-32 md:grid-cols-3">
        <FeatureCard
          icon={<Palette />}
          title="Visual, not verbal"
          body="Show options. Let clients pick the look — images, gifs, videos. No more vague Slack threads."
        />
        <FeatureCard
          icon={<Wand2 />}
          title="Editor settings, attached"
          body="Wire each option to LUTs, presets, and value cells. Your editor opens the brief and knows exactly how to recreate the look."
        />
        <FeatureCard
          icon={<MessageSquareText />}
          title="AI-style comment box"
          body="Every question has a composer at the bottom — clients can riff, paste links, drop refs. Just like the chat they already use."
        />
        <FeatureCard
          icon={<Layers3 />}
          title="Snapshot versioning"
          body="When you send a link, the brief is frozen. Edit safely while in-flight responses stay consistent."
        />
        <FeatureCard
          icon={<Sparkles />}
          title="Soft-glow dark mode"
          body="Designed for late-night edit sessions. Bright accents, deep neutrals, no eye-burn."
        />
        <FeatureCard
          icon={<Sparkles />}
          title="RTL ready"
          body="Full Arabic support out of the box. Right-to-left layouts, mirrored chrome."
        />
      </section>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Card className="transition-shadow hover:shadow-glow-sm">
      <CardContent className="flex flex-col gap-3 p-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {icon}
        </div>
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        <p className="text-sm text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}
