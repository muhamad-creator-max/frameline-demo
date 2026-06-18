"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { absoluteUrl } from "@/lib/utils";
import { FrameMark } from "@/components/brand/frame-mark";

export function SignupForm() {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: absoluteUrl("/auth/callback?next=/app"),
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Check your inbox to confirm your email.");
    router.replace("/login");
  }

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: absoluteUrl("/auth/callback?next=/app") },
    });
  }

  return (
    <Card className="w-full">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 inline-flex items-center justify-center">
          <FrameMark showWordmark={false} size={36} />
        </div>
        <CardTitle className="text-2xl">Start aligning</CardTitle>
        <CardDescription>Free tier — 1 brief, 10 client responses/mo.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Button variant="secondary" className="w-full justify-center" onClick={signInWithGoogle}>
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

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <Button type="submit" disabled={loading} className="mt-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Create account
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already a member?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
