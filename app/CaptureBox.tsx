"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import TaskCard, { type TaskView } from "./TaskCard";

/** Native camera bridge (Capacitor) — only present in the Android app. */
type NativeCap = {
  isNativePlatform?: () => boolean;
  Plugins?: {
    Camera?: {
      getPhoto: (opts: {
        quality?: number;
        source?: string;
        resultType?: string;
        allowEditing?: boolean;
      }) => Promise<{ dataUrl?: string }>;
    };
  };
};

/** Convert a data: URL (from the Camera plugin) into a File for upload. */
function dataUrlToFile(dataUrl: string, name: string): File {
  const [meta, b64] = dataUrl.split(",");
  const mime = /data:(.*?);/.exec(meta)?.[1] || "image/jpeg";
  const bin = atob(b64 ?? "");
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new File([arr], name, { type: mime });
}

/** One-tap examples for first-timers — they fill the box so the "aha" is one tap away. */
const EXAMPLES = [
  "Dentist Tuesday at 3pm",
  "Pay £42 water bill by Friday",
  "Mum's birthday on 20 June",
];

/**
 * The capture-first entry point (SPEC §1, §6). Paste text or drop an image;
 * both run the same extraction pipeline. Manual entry is deliberately not the
 * primary flow.
 */
export default function CaptureBox({
  inboundAddress,
  lifeAreas = [],
}: {
  inboundAddress?: string | null;
  lifeAreas?: string[];
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [created, setCreated] = useState<TaskView[]>([]);
  const [createdVia, setCreatedVia] = useState("");
  const [showCreated, setShowCreated] = useState(false);

  // Tasks created from a native "Share to nudge" land here (stashed by
  // NativeExtras before it navigated back), so they get the same verify cards.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("nudge_shared_tasks");
      if (!raw) return;
      sessionStorage.removeItem("nudge_shared_tasks");
      const tasks = JSON.parse(raw);
      if (Array.isArray(tasks) && tasks.length) {
        setCreated(tasks as TaskView[]);
        setCreatedVia(" from your share");
      }
    } catch {
      /* ignore */
    }
  }, []);

  async function copyAddress() {
    if (!inboundAddress) return;
    try {
      await navigator.clipboard.writeText(inboundAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard blocked — ignore */
    }
  }
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [recording, setRecording] = useState(false);
  const [limited, setLimited] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  function report(result: {
    nothingActionable: boolean;
    tasks: unknown[];
    status: string;
    error?: string;
    ocr?: { method: string };
  }) {
    setCreated([]);
    setShowCreated(false);
    setLimited(false);
    if (result.status === "limit") {
      setIsError(false);
      setMessage(null);
      setLimited(true);
      return;
    }
    if (result.status === "failed") {
      setIsError(true);
      setMessage(`Couldn't read that one: ${result.error ?? "extraction failed"}`);
      return;
    }
    setIsError(false);
    const n = result.tasks.length;
    const via = result.ocr ? ` (read via ${result.ocr.method})` : "";
    if (result.nothingActionable || n === 0) {
      setMessage(`Nothing actionable found${via}. Nothing added.`);
    } else {
      // Keep the created tasks so the user can open and verify them.
      setCreated(result.tasks as TaskView[]);
      setCreatedVia(via);
      setMessage(null);
    }
    startTransition(() => router.refresh());
  }

  async function submitText() {
    if (text.trim().length === 0) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/ingest/text", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      report(data);
      if (res.ok && data.status !== "failed") setText("");
    } catch (e) {
      setIsError(true);
      setMessage(`Network error: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  /** Open the device camera (native) and capture a photo. Falls back to the
   *  capture file input on the web. */
  async function takePhoto() {
    const cap = (window as unknown as { Capacitor?: NativeCap }).Capacitor;
    const Camera = cap?.isNativePlatform?.() ? cap.Plugins?.Camera : null;
    if (!Camera) {
      cameraRef.current?.click(); // web: HTML capture input
      return;
    }
    try {
      const photo = await Camera.getPhoto({
        quality: 80,
        source: "CAMERA",
        resultType: "dataUrl",
        allowEditing: false,
      });
      if (photo?.dataUrl) submitImage(dataUrlToFile(photo.dataUrl, "photo.jpg"));
    } catch {
      /* user cancelled or camera unavailable — do nothing */
    }
  }

  async function submitImage(file: File) {
    setBusy(true);
    setMessage("Reading image…");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/ingest/image", { method: "POST", body: fd });
      const data = await res.json();
      report(data);
    } catch (e) {
      setIsError(true);
      setMessage(`Network error: ${(e as Error).message}`);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function startRecording() {
    setMessage(null);
    setIsError(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, {
          type: rec.mimeType || "audio/webm",
        });
        submitAudio(blob);
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch (e) {
      setIsError(true);
      setMessage(`Couldn't access the mic: ${(e as Error).message}`);
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
    setBusy(true);
    setMessage("Transcribing your note…");
  }

  async function submitAudio(blob: Blob) {
    try {
      const ext = (blob.type.split("/")[1] || "webm").split(";")[0];
      const fd = new FormData();
      fd.append("file", blob, `voice-note.${ext}`);
      const res = await fetch("/api/ingest/audio", { method: "POST", body: fd });
      const data = await res.json();
      report(data);
    } catch (e) {
      setIsError(true);
      setMessage(`Network error: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="capture">
      <p className="capture-lead">What do you need to remember?</p>
      <p className="capture-sub">
        Type it, paste a message, snap a photo or record a note — Nudge finds the
        dates, amounts &amp; to-dos and reminds you.
      </p>
      <textarea
        ref={textareaRef}
        placeholder="e.g. Dentist Tuesday 3pm · Pay £42 water bill Friday · Mum's birthday 20 June"
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={busy}
      />
      {text.trim().length === 0 && !busy && created.length === 0 && (
        <div className="capture-examples">
          <span className="capture-examples-label">New here? Tap one to try:</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              className="example-chip"
              onClick={() => {
                setText(ex);
                textareaRef.current?.focus();
              }}
            >
              {ex}
            </button>
          ))}
        </div>
      )}
      <div className="capture-row">
        <button
          className="primary"
          onClick={submitText}
          disabled={busy || text.trim().length === 0}
        >
          {busy ? "Working…" : "Capture"}
        </button>
        <button className="cap-camera" onClick={takePhoto} disabled={busy}>
          📷 Photo
        </button>
        <button onClick={() => fileRef.current?.click()} disabled={busy}>
          🖼 Gallery
        </button>
        {recording ? (
          <button className="recording" onClick={stopRecording}>
            ⏹ Stop
          </button>
        ) : (
          <button onClick={startRecording} disabled={busy}>
            🎤 Voice note
          </button>
        )}
        {/* Camera-first: opens the camera to take a photo. */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) submitImage(f);
          }}
        />
        {/* Gallery / files: pick an existing image. */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) submitImage(f);
          }}
        />
        {message && (
          <span className={`note ${isError ? "error" : ""}`}>{message}</span>
        )}
      </div>
      {limited && (
        <div className="capture-limit">
          You’ve used your free captures this month.{" "}
          <a href="/upgrade">Go Pro for unlimited →</a>
        </div>
      )}

      {created.length > 0 && (
        <div className="capture-result">
          <button
            type="button"
            className="created-toggle"
            onClick={() => setShowCreated((s) => !s)}
            aria-expanded={showCreated}
          >
            ✓ Added {created.length} {created.length === 1 ? "task" : "tasks"}
            {createdVia} — {showCreated ? "hide" : "check them"}
            <span className="chev">{showCreated ? "▴" : "▾"}</span>
          </button>
          {showCreated && (
            <div className="created-list">
              {created.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  review={t.status === "review"}
                  lifeAreas={lifeAreas}
                  onActioned={() =>
                    setCreated((prev) => prev.filter((x) => x.id !== t.id))
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}
      <p className="capture-hint">
        On your phone you can also <strong>Share to Nudge</strong> from any app —
        or forward an email to your{" "}
        {inboundAddress ? (
          <button type="button" className="link copy-addr" onClick={copyAddress}>
            {copied ? `Copied ${inboundAddress} ✓` : "personal Nudge address"}
          </button>
        ) : (
          <a href="/profile">personal Nudge address</a>
        )}
        {inboundAddress && !copied ? " (tap to copy)" : ""}
      </p>
    </div>
  );
}
