"use client";

import { useState } from "react";

interface Rule {
  daysBefore: number;
  time: string;
}
type Rules = Record<string, Rule[]>;
interface Channels {
  email: boolean;
  push: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  pay: "Pay — money out by a date",
  book: "Book — arrange a slot/appointment",
  attend: "Attend — be somewhere at a set time",
  prepare: "Prepare — have something ready / bring something",
  send: "Send — deliver or reply to someone",
  renew: "Renew — before something lapses or auto-charges",
  reminder: "Reminder — general time-based nudge",
  fyi: "FYI — informational (no reminders)",
};

function ruleSummary(r: Rule): string {
  const when =
    r.daysBefore === 0
      ? "on the day"
      : r.daysBefore === 1
        ? "1 day before"
        : r.daysBefore === 7
          ? "1 week before"
          : `${r.daysBefore} days before`;
  return `${when} at ${r.time}`;
}

/* base64url VAPID key -> Uint8Array for PushManager.subscribe */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export default function SettingsForm({
  initialRules,
  defaults,
  initialChannels,
  initialDigestHour,
  initialLifeAreas,
  defaultLifeAreas,
  pushAvailable,
}: {
  initialRules: Rules;
  defaults: Rules;
  initialChannels: Channels;
  initialDigestHour: number;
  initialLifeAreas: string[];
  defaultLifeAreas: string[];
  pushAvailable: boolean;
}) {
  const [rules, setRules] = useState<Rules>(structuredClone(initialRules));
  const [channels, setChannels] = useState<Channels>(initialChannels);
  const [digestHour, setDigestHour] = useState(initialDigestHour);
  const [lifeAreas, setLifeAreas] = useState<string[]>([...initialLifeAreas]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pushMsg, setPushMsg] = useState<string | null>(null);

  const categories = Object.keys(defaults).filter((c) => c !== "fyi");

  function updateRule(cat: string, i: number, patch: Partial<Rule>) {
    setRules((prev) => {
      const next = { ...prev };
      const list = [...(next[cat] ?? [])];
      list[i] = { ...list[i], ...patch };
      next[cat] = list;
      return next;
    });
  }
  function addRule(cat: string) {
    setRules((prev) => ({
      ...prev,
      [cat]: [...(prev[cat] ?? []), { daysBefore: 1, time: "09:00" }],
    }));
  }
  function removeRule(cat: string, i: number) {
    setRules((prev) => ({
      ...prev,
      [cat]: (prev[cat] ?? []).filter((_, j) => j !== i),
    }));
  }
  function resetCat(cat: string) {
    setRules((prev) => ({ ...prev, [cat]: structuredClone(defaults[cat] ?? []) }));
  }

  function updateArea(i: number, value: string) {
    setLifeAreas((prev) => prev.map((a, j) => (j === i ? value : a)));
  }
  function addArea() {
    setLifeAreas((prev) => [...prev, ""]);
  }
  function removeArea(i: number) {
    setLifeAreas((prev) => prev.filter((_, j) => j !== i));
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const cleanedAreas = Array.from(
        new Set(lifeAreas.map((a) => a.trim().toLowerCase()).filter(Boolean)),
      );
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reminderRules: rules,
          channels,
          digestHour,
          lifeAreas: cleanedAreas,
        }),
      });
      setMsg(res.ok ? "Saved. Reminders updated." : "Save failed.");
    } catch (e) {
      setMsg(`Error: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  async function enablePush() {
    setPushMsg(null);
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setPushMsg("This browser doesn't support notifications.");
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setPushMsg("Permission denied.");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const { publicKey } = await fetch("/api/push/vapid").then((r) => r.json());
      if (!publicKey) {
        setPushMsg("Server push keys not configured.");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
      const json = sub.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      setChannels((c) => ({ ...c, push: true }));
      setPushMsg("Notifications enabled on this device.");
    } catch (e) {
      setPushMsg(`Couldn't enable: ${(e as Error).message}`);
    }
  }

  async function testPush() {
    setPushMsg(null);
    const res = await fetch("/api/push/test", { method: "POST" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setPushMsg(`Test failed: ${d.error ?? res.status}`);
      return;
    }
    const pushPart = d.push?.configured
      ? `Push: accepted by ${d.push.delivered} device(s)`
      : "Push: not configured on server";
    const emailPart = d.email?.configured
      ? d.email.sent
        ? `Email: sent to ${d.to}`
        : "Email: send failed (check Resend key/sender)"
      : "Email: not configured on server";
    setPushMsg(`${pushPart} · ${emailPart}`);
  }

  return (
    <div className="settings">
      <section className="panel">
        <h2>How you're nudged</h2>
        <label className="row">
          <input
            type="checkbox"
            checked={channels.email}
            onChange={(e) => setChannels({ ...channels, email: e.target.checked })}
          />
          <span>Email</span>
        </label>
        <label className="row">
          <input
            type="checkbox"
            checked={channels.push}
            onChange={(e) => setChannels({ ...channels, push: e.target.checked })}
          />
          <span>App notifications (web push)</span>
        </label>
        <div className="capture-row">
          <button onClick={enablePush} disabled={!pushAvailable}>
            Enable on this device
          </button>
          <button onClick={testPush}>Send test (email + push)</button>
          {!pushAvailable && (
            <span className="note">Push not configured on the server yet.</span>
          )}
          {pushMsg && <span className="note">{pushMsg}</span>}
        </div>
      </section>

      <section className="panel">
        <h2>Daily digest</h2>
        <label className="row">
          <span>Send my morning digest at</span>
          <select
            value={digestHour}
            onChange={(e) => setDigestHour(Number(e.target.value))}
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </select>
          <span className="note">your local time</span>
        </label>
      </section>

      <section className="panel">
        <h2>Life areas</h2>
        <p className="note">
          The tags nudge uses to group tasks by area of life. Add or rename them
          to fit you — the extractor will only use the areas in this list.
        </p>
        {lifeAreas.map((area, i) => (
          <div key={i} className="rule-row">
            <input
              value={area}
              placeholder="e.g. school"
              onChange={(e) => updateArea(i, e.target.value)}
            />
            <button className="link" onClick={() => removeArea(i)}>
              remove
            </button>
          </div>
        ))}
        <div className="capture-row">
          <button className="link" onClick={addArea}>
            + add area
          </button>
          <button className="link" onClick={() => setLifeAreas([...defaultLifeAreas])}>
            reset to defaults
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>Reminder schedule per category</h2>
        <p className="note">
          Each rule fires that many days before the due date, at the time you
          set (your local time). Leave a category empty for no reminders.
        </p>
        {categories.map((cat) => (
          <div key={cat} className="cat-block">
            <div className="cat-head">
              <strong>{CATEGORY_LABELS[cat] ?? cat}</strong>
              <button className="link" onClick={() => resetCat(cat)}>
                reset to default
              </button>
            </div>
            {(rules[cat] ?? []).map((r, i) => (
              <div key={i} className="rule-row">
                <input
                  type="number"
                  min={0}
                  value={r.daysBefore}
                  onChange={(e) =>
                    updateRule(cat, i, {
                      daysBefore: Math.max(0, Number(e.target.value)),
                    })
                  }
                />
                <span>days before, at</span>
                <input
                  type="time"
                  value={r.time}
                  onChange={(e) => updateRule(cat, i, { time: e.target.value })}
                />
                <span className="note">{ruleSummary(r)}</span>
                <button className="link" onClick={() => removeRule(cat, i)}>
                  remove
                </button>
              </div>
            ))}
            <button className="link" onClick={() => addRule(cat)}>
              + add reminder
            </button>
          </div>
        ))}
      </section>

      <div className="capture-row sticky-save">
        <button className="primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save preferences"}
        </button>
        {msg && <span className="note">{msg}</span>}
      </div>
    </div>
  );
}
