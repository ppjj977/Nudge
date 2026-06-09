import { redirect } from "next/navigation";
import { getCurrentUser, googleEnabled, signupAllowed } from "@/lib/auth";
import AuthForm from "../AuthForm";

export const dynamic = "force-dynamic";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/");
  // Pre-launch: public sign-up is closed — collect interest instead. Testers
  // arriving via a valid invite link (cookie set by /api/invite) are let in.
  if (!(await signupAllowed())) redirect("/register-interest");
  const { next } = await searchParams;

  return (
    <div className="auth-wrap">
      <div className="greeting">
        <h1>Create your account</h1>
        <p>Start capturing in seconds — it&apos;s free.</p>
      </div>
      <AuthForm mode="signup" googleEnabled={googleEnabled()} next={next} />
      <p className="note legal-consent">
        By creating an account you agree to our{" "}
        <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.
      </p>
    </div>
  );
}
