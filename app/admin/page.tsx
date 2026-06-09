import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { planStats, listPromoCodes } from "@/lib/plan";
import { listInterest, FREE_FOR_LIFE_COHORT } from "@/lib/interest";
import AdminPanel from "../AdminPanel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireUser();
  if (!config.adminEmail || user.email.toLowerCase() !== config.adminEmail) {
    notFound();
  }
  const [stats, codes, interest] = await Promise.all([
    planStats(),
    listPromoCodes(),
    listInterest(),
  ]);

  return (
    <>
      <div className="settings-head">
        <Link href="/" className="back">
          ← Timeline
        </Link>
        <h1>Admin</h1>
        <p className="note">Subscribers, comps and promo codes.</p>
      </div>

      <section className="panel">
        <h2 className="section">Subscribers</h2>
        <div className="stat-grid">
          <div className="stat"><b>{stats.total}</b><span>Total users</span></div>
          <div className="stat"><b>{stats.pro}</b><span>Pro (active)</span></div>
          <div className="stat"><b>{stats.free}</b><span>Free</span></div>
          <div className="stat"><b>{stats.comp}</b><span>Comped</span></div>
          <div className="stat"><b>{stats.promo}</b><span>Via promo</span></div>
          <div className="stat"><b>{stats.expiringSoon}</b><span>Expiring ≤7d</span></div>
        </div>
        <p className="note">
          Once you wire up Play Billing / Stripe, their dashboards show paid
          subscriber counts, revenue and churn — this panel covers comps and
          codes you grant directly.
        </p>
      </section>

      <section className="panel">
        <h2 className="section">Tester invite links</h2>
        <p className="note">
          Public sign-up stays closed (everyone else sees register-interest). Share
          a link below to let a specific tester create an account — any sign-in
          method works, and the access lasts 14 days in their browser.
        </p>
        {config.signupInviteCodes.length === 0 ? (
          <p className="note">
            None set. Add <code>SIGNUP_INVITE_CODES</code> (comma-separated, e.g.{" "}
            <code>TESTERS26,FAMILY</code>) to your environment, redeploy, then reload.
          </p>
        ) : (
          <ul className="code-list">
            {config.signupInviteCodes.map((c) => (
              <li key={c}>
                <b>{c}</b>
                <span>
                  {(config.appBaseUrl ?? "https://nudgelive.co.uk").replace(/\/$/, "")}
                  /api/invite?code={encodeURIComponent(c)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="note">
          After a tester signs up, make them Pro (no payment) with{" "}
          <strong>Grant Pro to someone</strong> below.
        </p>
      </section>

      <section className="panel">
        <h2 className="section">Waitlist · register interest ({interest.length})</h2>
        {interest.length === 0 ? (
          <p className="note">No sign-ups yet. Share the /register-interest link.</p>
        ) : (
          <>
            <p className="note">
              First {FREE_FOR_LIFE_COHORT} (highlighted) are owed Pro free for life at
              launch.
            </p>
            <ul className="code-list interest-list">
              {interest.map((i) => (
                <li key={i.id} className={i.position <= FREE_FOR_LIFE_COHORT ? "free-life" : ""}>
                  <b>
                    #{i.position} {i.name || "—"}
                  </b>
                  <span>
                    {i.email}
                    {i.note ? ` · ${i.note}` : ""}
                    {i.position <= FREE_FOR_LIFE_COHORT ? " · 🎁 free for life" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <AdminPanel
        codes={codes.map((c) => ({
          code: c.code,
          duration_days: c.duration_days,
          max_redemptions: c.max_redemptions,
          redeemed_count: c.redeemed_count,
        }))}
      />
    </>
  );
}
