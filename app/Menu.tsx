"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/** Header burger menu: navigation that isn't the primary timeline view. */
export default function Menu() {
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
          <Link href="/" className="menu-item" role="menuitem" onClick={close}>
            Timeline
          </Link>
          <Link href="/done" className="menu-item" role="menuitem" onClick={close}>
            Closed Nudges
          </Link>
          <Link
            href="/settings"
            className="menu-item"
            role="menuitem"
            onClick={close}
          >
            Settings
          </Link>
          <Link
            href="/help"
            className="menu-item"
            role="menuitem"
            onClick={close}
          >
            ? Categories &amp; help
          </Link>
        </div>
      )}
    </div>
  );
}
