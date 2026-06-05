"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const NAV = [
  { href: "/", label: "Timeline" },
  { href: "/calendar", label: "Calendar" },
  { href: "/lists", label: "Lists" },
  { href: "/digest", label: "Digest" },
  { href: "/money", label: "Money" },
  { href: "/filter", label: "Filter" },
  { href: "/done", label: "Closed nudges" },
];

const ACCOUNT = [
  { href: "/family", label: "Family" },
  { href: "/profile", label: "Profile" },
  { href: "/settings", label: "Settings" },
  { href: "/help", label: "Categories & help" },
];

/** Header burger menu: navigation that isn't the primary timeline view. */
export default function Menu({
  userName,
  userEmail,
}: {
  userName?: string | null;
  userEmail?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="menu" ref={ref}>
      <button
        className="burger"
        aria-label="Menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span />
        <span />
        <span />
      </button>
      {open && (
        <div className="menu-panel" role="menu">
          {(userName || userEmail) && (
            <div className="menu-id">
              <div className="menu-id-name">{userName || userEmail}</div>
              {userName && userEmail && (
                <div className="menu-id-email">{userEmail}</div>
              )}
            </div>
          )}

          <div className="menu-group">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="menu-item"
                role="menuitem"
                onClick={close}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="menu-sep" />

          <div className="menu-group">
            {ACCOUNT.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="menu-item"
                role="menuitem"
                onClick={close}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="menu-sep" />

          <button
            className="menu-item signout"
            role="menuitem"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              location.href = "/login";
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
