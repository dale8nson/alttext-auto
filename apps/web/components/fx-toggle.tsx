"use client";
import { useEffect, useState } from "react";

function setFxClass(on: boolean) {
  const root = document.documentElement;
  if (!on) root.classList.add("fx-off");
  else root.classList.remove("fx-off");
}

export default function FxToggle() {
  const [on, setOn] = useState(true);

  useEffect(() => {
    const stored = (typeof window !== "undefined" && localStorage.getItem("fx")) as "on" | "off" | null;
    const initial = stored ? stored === "on" : true;
    setOn(initial);
    setFxClass(initial);
  }, []);

  function toggle() {
    const next = !on;
    setOn(next);
    localStorage.setItem("fx", next ? "on" : "off");
    setFxClass(next);
  }

  return (
    <button
      onClick={toggle}
      className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      aria-pressed={on}
      title="Toggle visual effects"
    >
      <span className="inline-block h-2 w-2 rounded-full" style={{backgroundColor: on ? '#22c55e' : '#64748b'}} />
      {on ? 'Effects on' : 'Effects off'}
    </button>
  );
}

