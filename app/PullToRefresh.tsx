"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Pull-to-refresh for the timeline (and other list pages). When the page is
 * scrolled to the top and the user drags down past a threshold, we trigger a
 * soft refresh (re-runs the server components, so newly-arrived tasks — e.g.
 * captured by email — appear without closing the app).
 */
export default function PullToRefresh() {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const distRef = useRef(0);
  const busyRef = useRef(false);

  useEffect(() => {
    const THRESHOLD = 64;
    const MAX = 96;
    const setDist = (d: number) => {
      distRef.current = d;
      setPull(d);
    };

    function onStart(e: TouchEvent) {
      if (busyRef.current || window.scrollY > 0) {
        startY.current = null;
        return;
      }
      startY.current = e.touches[0]?.clientY ?? null;
    }
    function onMove(e: TouchEvent) {
      if (startY.current == null || busyRef.current) return;
      if (window.scrollY > 0) {
        startY.current = null;
        setDist(0);
        return;
      }
      const dy = (e.touches[0]?.clientY ?? 0) - startY.current;
      if (dy <= 0) {
        setDist(0);
        return;
      }
      setDist(Math.min(MAX, dy * 0.5)); // elastic resistance
      if (e.cancelable) e.preventDefault(); // suppress native overscroll
    }
    function onEnd() {
      if (startY.current == null) return;
      startY.current = null;
      if (distRef.current >= THRESHOLD) {
        busyRef.current = true;
        setRefreshing(true);
        setDist(THRESHOLD);
        router.refresh();
        // router.refresh() has no completion callback; clear after a beat.
        window.setTimeout(() => {
          busyRef.current = false;
          setRefreshing(false);
          setDist(0);
        }, 900);
      } else {
        setDist(0);
      }
    }

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [router]);

  const visible = pull > 0 || refreshing;
  return (
    <div
      className="ptr"
      aria-hidden="true"
      style={{
        transform: `translateX(-50%) translateY(${visible ? pull : 0}px)`,
        opacity: visible ? 1 : 0,
      }}
    >
      <span className={`ptr-spin ${refreshing ? "is-spinning" : ""}`}>↻</span>
    </div>
  );
}
