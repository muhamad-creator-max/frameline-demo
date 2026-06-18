import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-60" aria-hidden />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6">
        <LoginForm />
      </div>
    </div>
  );
}
