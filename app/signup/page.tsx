import { redirect } from "next/navigation";
import { getCurrentUser, googleEnabled } from "@/lib/auth";
import AuthForm from "../AuthForm";

export const dynamic = "force-dynamic";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/");
  const { next } = await searchParams;

  return (
    <div className="auth-wrap">
      <div className="greeting">
        <h1>Create your account</h1>
        <p>Start capturing in seconds — it&apos;s free.</p>
      </div>
      <AuthForm mode="signup" googleEnabled={googleEnabled()} next={next} />
    </div>
  );
}
