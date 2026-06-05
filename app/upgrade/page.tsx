import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { isPro, FREE_MONTHLY_CAPTURES } from "@/lib/plan";
import RedeemForm from "../RedeemForm";

export const dynamic = "force-dynamic";

export default async function UpgradePage() {
  const user = await requireUser();
  const pro = isPro(user);
  const until = user.plan_until ? new Date(user.plan_until) : null;

  return (
    <>
      <div className="settings-head">
        <Link href="/" className="back">
          ← Timeline
        </Link>
        <h1>nudge Pro</h1>
      </div>

      {pro ? (
        <section className="panel">
          <h2 className="section">You’re on Pro 🎉</h2>
          <p className="note">
            Unlimited captures and all the family features are on.
            {until ? ` Your access runs until ${until.toLocaleDateString()}.` : ""}
          </p>
        </section>
      ) : (
        <section className="panel">
          <h2 className="section">Go unlimited</h2>
          <p className="note">
            Free includes {FREE_MONTHLY_CAPTURES} AI captures a month. Pro removes
            the cap and unlocks the load-sharing features:
          </p>
          <ul className="pro-list">
            <li>Unlimited captures — text, photo, voice &amp; email-in</li>
            <li>Recurring tasks, birthdays &amp; trips</li>
            <li>Nudge Family — shared tasks &amp; lists</li>
            <li>Daily digest</li>
          </ul>
          <p className="note">
            Paid subscriptions are coming shortly. In the meantime, if you have a
            code, redeem it below.
          </p>
        </section>
      )}

      <section className="panel">
        <h2 className="section">Have a code?</h2>
        <RedeemForm />
      </section>
    </>
  );
}
