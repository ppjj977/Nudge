"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface PlaceItem {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number;
}

export default function PlacesManager({ initial }: { initial: PlaceItem[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [radius, setRadius] = useState(150);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setMsg("This device can’t share a location.");
      return;
    }
    setLocating(true);
    setMsg(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setMsg("Couldn’t get your location — allow location access and try again.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function save() {
    if (!name.trim()) {
      setMsg("Give the place a name.");
      return;
    }
    if (!coords) {
      setMsg("Set the location first (tap “Use my current location”).");
      return;
    }
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/places", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, lat: coords.lat, lng: coords.lng, radius }),
    });
    setBusy(false);
    if (r.ok) {
      setName("");
      setCoords(null);
      setRadius(150);
      router.refresh();
    } else {
      const d = await r.json().catch(() => ({}));
      setMsg(d.error || "Couldn’t save that place.");
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this place? Any tasks linked to it will lose their alert.")) return;
    await fetch(`/api/places?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <>
      <section className="panel">
        <h2 className="section">Add a place</h2>
        <label className="field">
          <span>Name</span>
          <input value={name} placeholder="Home" onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="place-loc-row">
          <button onClick={useMyLocation} disabled={locating}>
            {locating ? "Locating…" : "📍 Use my current location"}
          </button>
          {coords && (
            <span className="note">
              Set: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
            </span>
          )}
        </div>
        <label className="field">
          <span>Radius: {radius} m</span>
          <input
            type="range"
            min={80}
            max={2000}
            step={10}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
          />
        </label>
        <button className="primary" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save place"}
        </button>
        {msg && <p className="note">{msg}</p>}
        <p className="note">
          Stand at (or near) the place when you tap “Use my current location” for the
          most accurate geofence.
        </p>
      </section>

      <section className="panel">
        <h2 className="section">Your places</h2>
        {initial.length === 0 ? (
          <p className="note">No places yet — add your first above.</p>
        ) : (
          <ul className="place-list">
            {initial.map((p) => (
              <li key={p.id} className="place-item">
                <div>
                  <b>{p.name}</b>
                  <span className="note">
                    {p.lat.toFixed(4)}, {p.lng.toFixed(4)} · {p.radius} m
                  </span>
                </div>
                <button className="link" onClick={() => remove(p.id)}>
                  remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
