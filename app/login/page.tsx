import { redirect } from "next/navigation";
import { getCurrentUser, googleEnabled } from "@/lib/auth";
import AuthForm from "../AuthForm";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  expired: "That sign-in link was invalid or expired. Try again.",
  oauth: "Google sign-in didn't complete. Please try again.",
  google_unconfigured: "Google sign-in isn't set up yet — use email instead.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/");
  const { error } = await searchParams;

  return (
    <div className="auth-wrap">
      <div className="greeting">
        <h1>Welcome back</h1>
        <p>Sign in to your nudge.</p>
      </div>
      <AuthForm
        mode="signin"
        googleEnabled={googleEnabled()}
        initialMessage={error ? (ERRORS[error] ?? null) : null}
      />
    </div>
  );
}
