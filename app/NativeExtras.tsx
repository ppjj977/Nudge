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
  convertFileSrc?: (url: string) => string;
  Plugins?: {
    SendIntent?: { checkSendIntentReceived: () => Promise<SharedIntent> };
    Filesystem?: { readFile: (o: { path: string }) => Promise<{ data: string }> };
    Preferences?: { set: (o: { key: string; value: string }) => Promise<void> };
  };
};

/** Read a shared image into a Blob, trying Filesystem then a fetch fallback. */
async function readSharedImage(
  cap: Cap,
  url: string,
  mime: string,
): Promise<Blob | null> {
  const path = decodeURIComponent(url);
  try {
    const fs = cap.Plugins?.Filesystem;
    if (fs) {
      const read = await fs.readFile({ path });
      if (read?.data) return base64ToBlob(read.data, mime);
    }
  } catch {
    /* fall through to fetch */
  }
  try {
    const src = cap.convertFileSrc?.(url);
    if (src) {
      const res = await fetch(src);
      if (res.ok) return await res.blob();
    }
  } catch {
    /* give up */
  }
  return null;
}

/** Decode a base64 string into a Blob of the given mime type. */
function base64ToBlob(b64: string, mime: string): Blob {
  const clean = b64.includes(",") ? b64.split(",")[1] : b64;
  const bytes = atob(clean);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/** POST shared text or an image file to the capture pipeline; return the
 *  timeline URL with the outcome toast. */
async function postShare(content: Blob | string): Promise<string> {
  const fd = new FormData();
  if (typeof content === "string") fd.append("text", content);
  else fd.append("file", content, "shared.jpg");
  const res = await fetch("/share", { method: "POST", body: fd });
  return res.ok ? "/?shared=added" : "/?shared=failed";
}

export default function NativeExtras() {
  useEffect(() => {
    const cap = (window as unknown as { Capacitor?: Cap }).Capacitor;
    if (!cap?.isNativePlatform?.()) return;

    // --- Share-target: forward shared text OR an image into capture. ---
    async function handleSharedIntent() {
      try {
        const SendIntent = cap?.Plugins?.SendIntent;
        if (!SendIntent) return;
        const r = await SendIntent.checkSendIntentReceived();
        if (!r || (!r.url && !r.title && !r.description)) return;

        const isImage =
          (r.type && r.type.startsWith("image")) ||
          (typeof r.url === "string" && r.url.startsWith("content://"));

        // Shared image: read its bytes and run them through OCR/vision.
        if (isImage && r.url) {
          const blob = await readSharedImage(cap!, r.url, r.type || "image/jpeg");
          window.location.href = blob
            ? await postShare(blob)
            : "/?shared=failed";
          return;
        }

        // Shared text / link.
        const parts = [r.title, r.description, r.url].filter(
          (s): s is string =>
            typeof s === "string" && s.trim().length > 0 && !s.startsWith("content://"),
        );
        const text = parts.join("\n").trim();
        if (!text) return;
        window.location.href = await postShare(text);
      } catch {
        /* no shared intent — ignore */
      }
    }

    // Cold start (app launched by the share) AND already-running (the plugin
    // fires `sendIntentReceived` on a new intent without reloading the page).
    handleSharedIntent();
    window.addEventListener("sendIntentReceived", handleSharedIntent);

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

    return () =>
      window.removeEventListener("sendIntentReceived", handleSharedIntent);
  }, []);

  return null;
}
