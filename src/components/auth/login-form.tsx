"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Mail, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { absoluteUrl } from "@/lib/utils";
import { FrameMark } from "@/components/brand/frame-mark";

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const supabase = React.useMemo(() => createClient(), []);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState<null | "email" | "google">(null);

  const redirectTo = search.get("redirect") ?? "/app";

  async function signInWithEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading("email");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    router.replace(redirectTo);
    router.refresh();
  }

  async function signInWithGoogle() {
    setLoading("google");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: absoluteUrl(`/auth/callback?next=${encodeURIComponent(redirectTo)}`) },
    });
    if (error) {
      setLoading(null);
      toast.error(error.message);
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 inline-flex items-center justify-center">
          <FrameMark showWordmark={false} size={36} />
        </div>
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <CardDescription>Sign in to keep your briefs flowing.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Button
          variant="secondary"
          className="w-full justify-center"
          onClick={signInWithGoogle}
          disabled={loading !== null}
        >
          {loading === "google" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <GoogleIcon />
          )}
          Continue with Google
        </Button>

        <div className="relative my-1">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or with email</span>
          </div>
        </div>

        <form onSubmit={signInWithEmail} className="flex flex-col gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@studio.com"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <Button type="submit" disabled={loading !== null} className="mt-2">
            {loading === "email" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail />}
            Sign in
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link href="/signup" className="text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.4-1.6 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.5 14.6 2.6 12 2.6 6.8 2.6 2.6 6.8 2.6 12s4.2 9.4 9.4 9.4c5.4 0 9-3.8 9-9.2 0-.6-.1-1.1-.2-1.6H12z"
      />
    </svg>
  );
}
