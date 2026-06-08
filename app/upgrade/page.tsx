import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { isPro, FREE_MONTHLY_CAPTURES } from "@/lib/plan";
import RedeemForm from "../RedeemForm";
import PurchasePro from "../PurchasePro";

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
            Free gives you {FREE_MONTHLY_CAPTURES} AI captures a month with
            in-app reminders. Pro removes the cap and unlocks more:
          </p>
          <ul className="pro-list">
            <li>Unlimited captures — text, photo, voice &amp; email-in</li>
            <li>Email reminders &amp; the daily digest</li>
            <li>Nudge Family — shared tasks &amp; lists for the household</li>
            <li>Recurring tasks, birthdays &amp; trips</li>
          </ul>
          <PurchasePro userId={user.id} />
        </section>
      )}

      <section className="panel">
        <h2 className="section">Have a code?</h2>
        <RedeemForm />
      </section>
    </>
  );
}
