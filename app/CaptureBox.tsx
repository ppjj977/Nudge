"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * The capture-first entry point (SPEC §1, §6). Paste text or drop an image;
 * both run the same extraction pipeline. Manual entry is deliberately not the
 * primary flow.
 */
export default function CaptureBox() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [, startTransition] = useTransition();

  function report(result: {
    nothingActionable: boolean;
    tasks: unknown[];
    status: string;
    error?: string;
    ocr?: { method: string };
  }) {
    if (result.status === "failed") {
      setIsError(true);
      setMessage(`Couldn't read that one: ${result.error ?? "extraction failed"}`);
      return;
    }
    setIsError(false);
    const n = result.tasks.length;
    const via = result.ocr ? ` (read via ${result.ocr.method})` : "";
    setMessage(
      result.nothingActionable
        ? `Nothing actionable found${via}. Nothing added.`
        : `Added ${n} ${n === 1 ? "item" : "items"}${via}.`,
    );
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

  return (
    <div className="capture">
      <textarea
        placeholder="Paste an email, newsletter, message export… or upload a screenshot below."
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={busy}
      />
      <div className="capture-row">
        <button
          className="primary"
          onClick={submitText}
          disabled={busy || text.trim().length === 0}
        >
          {busy ? "Working…" : "Capture"}
        </button>
        <button onClick={() => fileRef.current?.click()} disabled={busy}>
          Upload image
        </button>
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
    </div>
  );
}
