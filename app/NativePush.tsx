"use client";

import { useEffect } from "react";

/**
 * Native push registration for the Capacitor Android app. Uses the runtime
 * `window.Capacitor` global injected by the native shell, so the web build
 * needs no Capacitor dependency. In a normal browser this is a no-op.
 */
type CapPlugin = {
  checkPermissions: () => Promise<{ receive: string }>;
  requestPermissions: () => Promise<{ receive: string }>;
  register: () => Promise<void>;
  addListener: (event: string, cb: (data: unknown) => void) => void;
};
type Cap = {
  isNativePlatform?: () => boolean;
  Plugins?: { PushNotifications?: CapPlugin };
};

export default function NativePush() {
  useEffect(() => {
    const cap = (window as unknown as { Capacitor?: Cap }).Capacitor;
    if (!cap?.isNativePlatform?.()) return;
    const Push = cap.Plugins?.PushNotifications;
    if (!Push) return;

    (async () => {
      try {
        let perm = await Push.checkPermissions();
        if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
          perm = await Push.requestPermissions();
        }
        if (perm.receive !== "granted") return;

        Push.addListener("registration", (data) => {
          const token = (data as { value?: string })?.value;
          if (!token) return;
          fetch("/api/push/fcm/register", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ token }),
          }).catch(() => {});
        });
        Push.addListener("pushNotificationActionPerformed", (data) => {
          const url = (data as { notification?: { data?: { url?: string } } })
            ?.notification?.data?.url;
          if (url) window.location.href = url;
        });
        await Push.register();
      } catch {
        /* native push unavailable — ignore */
      }
    })();
  }, []);

  return null;
}
