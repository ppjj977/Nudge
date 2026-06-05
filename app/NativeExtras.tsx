"use client";

import { useEffect } from "react";

// Flip to true to surface (via alert) what the OS share hands over — useful for
// debugging share issues. Off in normal use; failures still show a toast.
const SHARE_DEBUG = false;

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

/**
 * Read a shared image into a Blob. The send-intent plugin copies the shared
 * file into our app's files dir and gives a `file://` path, so Filesystem can
 * read it directly. We try a few path forms because the plugin's exact
 * expectation varies. Returns the blob, or an error string for diagnostics.
 */
async function readSharedImage(
  cap: Cap,
  url: string,
  mime: string,
): Promise<{ blob: Blob | null; error?: string }> {
  const fs = cap.Plugins?.Filesystem;
  if (!fs) return { blob: null, error: "Filesystem plugin missing" };
  const decoded = decodeURIComponent(url);
  const candidates = [decoded, decoded.replace(/^file:\/\//, "")];
  let lastErr = "";
  for (const path of candidates) {
    try {
      const read = await fs.readFile({ path });
      if (read?.data) return { blob: base64ToBlob(read.data, mime) };
    } catch (e) {
      lastErr = (e as Error).message;
    }
  }
  return { blob: null, error: lastErr || "empty file" };
}

/** Decode a base64 string into a Blob of the given mime type. */
function base64ToBlob(b64: string, mime: string): Blob {
  const clean = b64.includes(",") ? b64.split(",")[1] : b64;
  const bytes = atob(clean);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

interface IngestResult {
  ok: boolean;
  status?: string;
  nothingActionable?: boolean;
  tasks?: unknown[];
}

/** Send a shared image through the same ingest endpoint the Upload button uses. */
async function ingestImage(blob: Blob): Promise<IngestResult> {
  const fd = new FormData();
  fd.append("file", blob, "shared.jpg");
  const res = await fetch("/api/ingest/image", { method: "POST", body: fd });
  return { ok: res.ok, ...(await res.json().catch(() => ({}))) };
}

/** Send shared text/links through the text ingest endpoint. */
async function ingestText(text: string): Promise<IngestResult> {
  const res = await fetch("/api/ingest/text", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  return { ok: res.ok, ...(await res.json().catch(() => ({}))) };
}

/**
 * Land a finished share: stash created tasks for the capture-verify view, then
 * navigate. Returns the destination URL.
 */
function landShare(result: IngestResult): string {
  if (!result.ok || result.status === "failed") return "/?shared=failed";
  if (result.nothingActionable || !(result.tasks && result.tasks.length))
    return "/?shared=nothing";
  try {
    sessionStorage.setItem("nudge_shared_tasks", JSON.stringify(result.tasks));
  } catch {
    /* sessionStorage unavailable — fall back to a toast */
    return "/?shared=added";
  }
  return "/?shared=added";
}

export default function NativeExtras() {
  useEffect(() => {
    const cap = (window as unknown as { Capacitor?: Cap }).Capacitor;
    if (!cap?.isNativePlatform?.()) return;

    // --- Share-target: forward shared text OR an image into capture. ---
    // `viaEvent` = triggered by an actual share into the running app, so it's
    // safe to surface diagnostics (a cold-start check fires on every launch).
    async function handleSharedIntent(viaEvent: boolean) {
      const dbg = (m: string) => {
        if (SHARE_DEBUG) window.alert(`nudge share — ${m}`);
      };
      try {
        const SendIntent = cap?.Plugins?.SendIntent;
        if (!SendIntent) {
          dbg("SendIntent plugin not found on the bridge");
          return;
        }
        let r: SharedIntent;
        try {
          r = await SendIntent.checkSendIntentReceived();
        } catch (e) {
          dbg("checkSendIntentReceived threw: " + (e as Error).message);
          return;
        }
        if (!r || (!r.url && !r.title && !r.description)) {
          if (viaEvent) dbg("no data in intent: " + JSON.stringify(r));
          return;
        }

        // De-dupe: landing a share reloads the page, and the plugin keeps
        // returning the same intent — without this guard it re-ingests in a
        // loop. Mark this intent handled (survives the reload via session).
        const marker = `${r.url ?? ""}|${r.title ?? ""}|${r.description ?? ""}`;
        try {
          if (sessionStorage.getItem("nudge_share_marker") === marker) return;
          sessionStorage.setItem("nudge_share_marker", marker);
        } catch {
          /* sessionStorage unavailable — proceed without dedupe */
        }

        dbg(`got type=${r.type ?? "?"} url=${(r.url ?? "").slice(0, 60)}`);

        const isImage =
          (r.type && r.type.startsWith("image")) ||
          (typeof r.url === "string" && r.url.startsWith("content://")) ||
          (typeof r.url === "string" && /\.(jpe?g|png|gif|webp|heic)$/i.test(r.url));

        // Shared image: read its bytes and run them through OCR/vision.
        if (isImage && r.url) {
          const { blob, error } = await readSharedImage(cap!, r.url, r.type || "image/jpeg");
          if (!blob) {
            dbg("read failed: " + error);
            window.location.href = "/?shared=failed";
            return;
          }
          try {
            window.location.href = landShare(await ingestImage(blob));
          } catch (e) {
            dbg("upload failed: " + (e as Error).message);
            window.location.href = "/?shared=failed";
          }
          return;
        }

        // Shared text / link.
        const parts = [r.title, r.description, r.url].filter(
          (s): s is string =>
            typeof s === "string" && s.trim().length > 0 && !s.startsWith("content://"),
        );
        const text = parts.join("\n").trim();
        if (!text) return;
        try {
          window.location.href = landShare(await ingestText(text));
        } catch (e) {
          dbg("upload failed: " + (e as Error).message);
          window.location.href = "/?shared=failed";
        }
      } catch (e) {
        dbg("error: " + (e as Error).message);
      }
    }

    // Cold start (app launched by the share) AND already-running (the plugin
    // fires `sendIntentReceived` on a new intent without reloading the page).
    handleSharedIntent(false);
    const onShare = () => handleSharedIntent(true);
    window.addEventListener("sendIntentReceived", onShare);

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

    return () => window.removeEventListener("sendIntentReceived", onShare);
  }, []);

  return null;
}
