"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";

function daysLeft(start: number, days=7) {
  const end = start + days*24*60*60*1000;
  const left = Math.max(0, end - Date.now());
  return Math.ceil(left / (24*60*60*1000));
}

export default function TrialRibbon() {
  const [start, setStart] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const qs = new URLSearchParams(window.location.search);
      if (qs.get("installed") === "1" || qs.get("billing") === "success") {
        const now = Date.now();
        localStorage.setItem("trial_started_at", String(now));
      }
      const raw = localStorage.getItem("trial_started_at");
      if (raw) {
        const n = Number(raw);
        if (!Number.isNaN(n)) {
          setStart(n);
          setVisible(true);
        }
      }
    } catch {}
  }, []);

  const left = useMemo(() => (start ? daysLeft(start) : null), [start]);
  useEffect(() => {
    if (visible && left && left > 0 && barRef.current) {
      gsap.fromTo(
        barRef.current,
        { y: -60, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }
      );
    }
  }, [visible, left]);

  if (!visible || left === null || left <= 0) return null;

  return (
    <div
      ref={barRef}
      className="fixed top-14 left-0 right-0 z-40 w-full bg-amber-50 text-amber-900 dark:bg-amber-400/10 dark:text-amber-200 border-b border-amber-200/70 dark:border-amber-400/20"
      style={{ willChange: 'transform' }}
    >
      <div className="container-page flex items-center justify-between py-2 text-sm">
        <span className="font-medium">Trial: {left} day{left === 1 ? '' : 's'} left</span>
        <a href="/billing" className="link">Upgrade now</a>
      </div>
    </div>
  );
}
