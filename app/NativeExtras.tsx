"use client";

import { useEffect } from "react";

/**
 * Native-only extras for the Capacitor Android app, driven through the runtime
 * `window.Capacitor` bridge (no Capacitor dependency in the web build):
 *  - Share-target: pull text shared into the app and run it through capture.
 *  - Widget sync: cache today's nudges in Preferences for the home-screen widget.
 * In a normal browser this is a no-op.
 */
type Cap = {
  isNativePlatform?: () => boolean;
  Plugins?: {
    SendIntent?: {
      checkSendIntentReceived: () => Promise<{
        title?: string;
        description?: string;
        url?: string;
      }>;
    };
    Preferences?: { set: (o: { key: string; value: string }) => Promise<void> };
  };
};

export default function NativeExtras() {
  useEffect(() => {
    const cap = (window as unknown as { Capacitor?: Cap }).Capacitor;
    if (!cap?.isNativePlatform?.()) return;

    // --- Share-target: forward shared text into the capture pipeline. ---
    (async () => {
      try {
        const SendIntent = cap.Plugins?.SendIntent;
        if (!SendIntent) return;
        const r = await SendIntent.checkSendIntentReceived();
        const parts = [r?.title, r?.description, r?.url].filter(
          (s): s is string =>
            typeof s === "string" && s.trim().length > 0 && !s.startsWith("content://"),
        );
        const text = parts.join("\n").trim();
        if (!text) return; // image/file shares handled in a later pass
        const fd = new FormData();
        fd.append("text", text);
        await fetch("/share", { method: "POST", body: fd });
        window.location.href = "/?shared=added";
      } catch {
        /* no shared intent — ignore */
      }
    })();

    // --- Widget sync: cache today's & tomorrow's nudges for the widget. ---
    (async () => {
      try {
        const Preferences = cap.Plugins?.Preferences;
        if (!Preferences) return;
        const res = await fetch("/api/tasks");
        if (!res.ok) return;
        const tl = await res.json();
        type T = { title: string; due_at: string | null; due_type: string };
        const today: T[] = Array.isArray(tl?.today) ? tl.today : [];
        const upcoming: T[] = [
          ...(Array.isArray(tl?.week) ? tl.week : []),
          ...(Array.isArray(tl?.later) ? tl.later : []),
        ];

        const now = new Date();
        const tmrw = new Date(now);
        tmrw.setDate(now.getDate() + 1);
        const pad = (n: number) => String(n).padStart(2, "0");
        const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        const tomorrowStr = ymd(tmrw);

        const mk = (t: T) => ({
          title: t.title,
          time:
            t.due_type === "datetime" && t.due_at
              ? new Date(t.due_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "",
        });
        const payload = {
          today: today.slice(0, 6).map(mk),
          tomorrow: upcoming
            .filter((t) => t.due_at && String(t.due_at).slice(0, 10) === tomorrowStr)
            .slice(0, 6)
            .map(mk),
        };
        await Preferences.set({ key: "widget_today", value: JSON.stringify(payload) });
      } catch {
        /* preferences unavailable — ignore */
      }
    })();
  }, []);

  return null;
}
