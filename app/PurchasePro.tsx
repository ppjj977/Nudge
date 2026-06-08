"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * In-app subscription purchase (Google Play Billing via RevenueCat). Digital
 * goods in the Android app MUST go through Play Billing, so this only offers a
 * purchase on the native build; on the web/PWA it points people to the app and
 * keeps promo-code redemption (rendered by the page). The native plugin is
 * reached through the Capacitor bridge global — same pattern as NativeGeofence
 * — so nothing is bundled into the web build.
 *
 * We configure RevenueCat with appUserID = our user id, which is exactly what
 * /api/revenuecat/webhook maps back to flip the user's plan to Pro.
 */
const RC_KEY = process.env.NEXT_PUBLIC_REVENUECAT_ANDROID_KEY;

interface RcPackage {
  identifier: string;
  packageType: string; // ANNUAL | MONTHLY | …
  product: { priceString: string; title: string };
}
interface RcOffering {
  availablePackages: RcPackage[];
}
interface PurchasesPlugin {
  configure: (o: { apiKey: string; appUserID?: string }) => Promise<void>;
  getOfferings: () => Promise<{ current: RcOffering | null }>;
  purchasePackage: (o: { aPackage: RcPackage }) => Promise<{
    customerInfo: { entitlements: { active: Record<string, unknown> } };
  }>;
  restorePurchases: () => Promise<{
    customerInfo: { entitlements: { active: Record<string, unknown> } };
  }>;
}
type Cap = {
  isNativePlatform?: () => boolean;
  Plugins?: { Purchases?: PurchasesPlugin };
};

const ENTITLEMENT = "pro";

export default function PurchasePro({ userId }: { userId: string }) {
  const router = useRouter();
  const [plugin, setPlugin] = useState<PurchasesPlugin | null>(null);
  const [packages, setPackages] = useState<RcPackage[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const cap = (window as unknown as { Capacitor?: Cap }).Capacitor;
    const Purchases = cap?.isNativePlatform?.() ? cap.Plugins?.Purchases : null;
    if (!Purchases || !RC_KEY) {
      setReady(true);
      return;
    }
    (async () => {
      try {
        await Purchases.configure({ apiKey: RC_KEY, appUserID: userId });
        const { current } = await Purchases.getOfferings();
        setPlugin(Purchases);
        // Annual first so the better-value plan leads.
        const pkgs = (current?.availablePackages ?? []).sort((a, b) =>
          a.packageType === "ANNUAL" ? -1 : b.packageType === "ANNUAL" ? 1 : 0,
        );
        setPackages(pkgs);
      } catch (e) {
        console.warn("[purchase] init failed", e);
      } finally {
        setReady(true);
      }
    })();
  }, [userId]);

  async function buy(pkg: RcPackage) {
    if (!plugin) return;
    setBusy(pkg.identifier);
    setMsg(null);
    try {
      const res = await plugin.purchasePackage({ aPackage: pkg });
      if (res.customerInfo.entitlements.active[ENTITLEMENT]) {
        setMsg("You’re on Pro 🎉 Thanks for supporting nudge!");
        // The webhook also flips the plan server-side; refresh to reflect it.
        setTimeout(() => router.refresh(), 1500);
      } else {
        setMsg("Purchase went through — your Pro access will activate shortly.");
      }
    } catch (e) {
      const err = e as { code?: string; message?: string };
      // RevenueCat sets userCancelled on the error for a dismissed sheet.
      if (!/cancel/i.test(err.code ?? err.message ?? "")) {
        setMsg("That didn’t complete. No charge was made — please try again.");
      }
    } finally {
      setBusy(null);
    }
  }

  async function restore() {
    if (!plugin) return;
    setBusy("restore");
    setMsg(null);
    try {
      const res = await plugin.restorePurchases();
      if (res.customerInfo.entitlements.active[ENTITLEMENT]) {
        setMsg("Restored — welcome back to Pro 🎉");
        setTimeout(() => router.refresh(), 1500);
      } else {
        setMsg("No previous purchase found on this account.");
      }
    } catch {
      setMsg("Couldn’t restore right now — please try again.");
    } finally {
      setBusy(null);
    }
  }

  if (!ready) return null;

  // Web / PWA, or native without billing configured: nudge them to the app.
  if (!plugin) {
    return (
      <p className="note">
        Subscriptions are purchased in the nudge Android app (via Google Play).
        Install nudge from Google Play to start your 7-day free trial — or redeem
        a code below.
      </p>
    );
  }

  if (packages.length === 0) {
    return <p className="note">Plans are loading… pull to refresh if this persists.</p>;
  }

  return (
    <div className="buy-plans">
      <p className="note">Start with a 7-day free trial. Cancel anytime in Google Play.</p>
      {packages.map((p) => {
        const annual = p.packageType === "ANNUAL";
        return (
          <button
            key={p.identifier}
            className={annual ? "primary buy-plan" : "buy-plan"}
            onClick={() => buy(p)}
            disabled={!!busy}
          >
            <span className="buy-plan-name">{annual ? "Annual" : "Monthly"}</span>
            <span className="buy-plan-price">
              {busy === p.identifier ? "Opening Google Play…" : `${p.product.priceString}${annual ? " / year" : " / month"}`}
            </span>
            {annual && <span className="buy-plan-tag">Best value</span>}
          </button>
        );
      })}
      {msg && <p className="note auth-msg">{msg}</p>}
      <button className="link-btn" onClick={restore} disabled={!!busy}>
        Restore a previous purchase
      </button>
    </div>
  );
}
