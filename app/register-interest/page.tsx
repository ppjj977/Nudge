import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { interestCount, FREE_FOR_LIFE_COHORT } from "@/lib/interest";
import LogoMark from "../LogoMark";
import RegisterInterest from "../RegisterInterest";

export const dynamic = "force-dynamic";

export default async function RegisterInterestPage({
  searchParams,
}: {
  searchParams: Promise<{ closed?: string; src?: string }>;
}) {
  // If sign-up is open, this page is obsolete — send people to the real flow.
  if (config.registrationOpen) redirect("/signup");

  const user = await getCurrentUser();
  if (user) redirect("/");

  const { closed, src } = await searchParams;
  const count = await interestCount();
  const spotsLeft = Math.max(0, FREE_FOR_LIFE_COHORT - count);

  return (
    <div className="auth-wrap interest-wrap">
      <div className="greeting interest-head">
        <LogoMark size={44} />
        <h1>Be first to try Nudge</h1>
        <p>
          We’re putting the finishing touches on Nudge before it lands on Google Play.
          Register your interest and we’ll send your invite the moment it’s ready.
        </p>
      </div>

      {closed && (
        <p className="note interest-closed">
          Sign-ups aren’t open just yet — pop your details in below and you’ll be first
          in line.
        </p>
      )}

      <div className="interest-promo">
        {spotsLeft > 0 ? (
          <>
            🎁 <b>First {FREE_FOR_LIFE_COHORT} get Nudge Pro free for life.</b>{" "}
            {spotsLeft} {spotsLeft === 1 ? "spot" : "spots"} left.
          </>
        ) : (
          <>
            🎁 The <b>free-for-life</b> spots are gone — register now and we’ll let you
            know the moment Nudge opens.
          </>
        )}
      </div>

      <RegisterInterest source={src} />

      <p className="note interest-foot">
        Already have an invite? <Link href="/login">Sign in</Link>
      </p>
    </div>
  );
}
