"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/** Grouped navigation — collapsible sections keep the menu calm at a glance. */
const GROUPS: { label: string; items: { href: string; label: string }[] }[] = [
  {
    label: "Plan",
    items: [
      { href: "/", label: "Timeline" },
      { href: "/recent", label: "Recently added" },
      { href: "/day", label: "Today (hour-by-hour)" },
      { href: "/calendar", label: "Calendar" },
    ],
  },
  {
    label: "Lists & places",
    items: [
      { href: "/lists", label: "Lists" },
      { href: "/places", label: "Places" },
    ],
  },
  {
    label: "Money & history",
    items: [
      { href: "/money", label: "Money" },
      { href: "/digest", label: "Daily digest" },
      { href: "/filter", label: "Filter" },
      { href: "/done", label: "Closed nudges" },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/upgrade", label: "nudge Pro" },
      { href: "/family", label: "Family" },
      { href: "/profile", label: "Profile" },
      { href: "/settings", label: "Settings" },
      { href: "/help", label: "Categories & help" },
    ],
  },
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
  const [section, setSection] = useState<string | null>("Plan");
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

          {GROUPS.map((g) => {
            const expanded = section === g.label;
            return (
              <div className="menu-section" key={g.label}>
                <button
                  className="menu-group-head"
                  aria-expanded={expanded}
                  onClick={() => setSection(expanded ? null : g.label)}
                >
                  {g.label}
                  <span className={`menu-chev ${expanded ? "open" : ""}`}>▾</span>
                </button>
                {expanded && (
                  <div className="menu-group">
                    {g.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="menu-item sub"
                        role="menuitem"
                        onClick={close}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

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
