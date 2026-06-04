"use client";

import { useEffect } from "react";

/**
 * Registers the service worker on load so nudge is installable (and thus usable
 * as a share target) and ready to receive push. Push permission is still only
 * requested when the user opts in from Settings.
 */
export default function SWRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* non-fatal */
      });
    }
  }, []);
  return null;
}
