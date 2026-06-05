"use client";

import { useEffect } from "react";

/**
 * Native-only extras for the Capacitor Android app, driven through the runtime
 * `window.Capacitor` bridge (no Capacitor dependency in the web build):
 *  - Share-target: pull text shared into the app and run it through capture.
 *  - Widget sync: cache today's nudges in Preferences for the home-screen widget.
 * In a normal browser this is a no-op.
 */
type SharedIntent = {
  title?: string;
  description?: string;
  type?: string;
  url?: string;
};
type Cap = {
  isNativePlatform?: () => boolean;
  Plugins?: {
    SendIntent?: { checkSendIntentReceived: () => Promise<SharedIntent> };
    Filesystem?: { readFile: (o: { path: string }) => Promise<{ data: string }> };
    Preferences?: { set: (o: { key: string; value: string }) => Promise<void> };
  };
};

/** Decode a base64 string into a Blob of the given mime type. */
function base64ToBlob(b64: string, mime: string): Blob {
  const clean = b64.includes(",") ? b64.split(",")[1] : b64;
  const bytes = atob(clean);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export default function NativeExtras() {
  useEffect(() => {
    const cap = (window as unknown as { Capacitor?: Cap }).Capacitor;
    if (!cap?.isNativePlatform?.()) return;

    // --- Share-target: forward shared text OR an image into capture. ---
    (async () => {
      try {
        const SendIntent = cap.Plugins?.SendIntent;
        if (!SendIntent) return;
        const r = await SendIntent.checkSendIntentReceived();
        if (!r) return;

        const isImage =
          (r.type && r.type.startsWith("image")) ||
          (typeof r.url === "string" && r.url.startsWith("content://"));

        // Shared image: read its bytes and run them through OCR/vision.
        if (isImage && r.url && cap.Plugins?.Filesystem) {
          const read = await cap.Plugins.Filesystem.readFile({
            path: decodeURIComponent(r.url),
          });
          const blob = base64ToBlob(read.data, r.type || "image/jpeg");
          const fd = new FormData();
          fd.append("file", blob, "shared.jpg");
          await fetch("/share", { method: "POST", body: fd });
          window.location.href = "/?shared=added";
          return;
        }

        // Shared text / link.
        const parts = [r.title, r.description, r.url].filter(
          (s): s is string =>
            typeof s === "string" && s.trim().length > 0 && !s.startsWith("content://"),
        );
        const text = parts.join("\n").trim();
        if (!text) return;
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
