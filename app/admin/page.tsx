import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { planStats, listPromoCodes } from "@/lib/plan";
import AdminPanel from "../AdminPanel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireUser();
  if (!config.adminEmail || user.email.toLowerCase() !== config.adminEmail) {
    notFound();
  }
  const [stats, codes] = await Promise.all([planStats(), listPromoCodes()]);

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
