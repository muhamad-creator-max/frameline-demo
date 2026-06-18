import { SignupForm } from "@/components/auth/signup-form";

export const metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-60" aria-hidden />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6">
        <SignupForm />
      </div>
    </div>
  );
}
