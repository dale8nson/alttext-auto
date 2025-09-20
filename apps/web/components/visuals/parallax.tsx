"use client";
import React, { useCallback, useRef } from "react";

export function Parallax({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const mx = (e.clientX - cx) / 40; // dampen
    const my = (e.clientY - cy) / 40;
    el.style.setProperty("--mx", `${mx}px`);
    el.style.setProperty("--my", `${my}px`);
  }, []);

  return (
    <div ref={ref} className="parallax" onMouseMove={onMove} aria-hidden>
      {children}
    </div>
  );
}

export function Layer({ depth = 0.03, className = "", children }: { depth?: number; className?: string; children?: React.ReactNode }) {
  const style = { ['--d' as any]: depth } as React.CSSProperties;
  return (
    <div className={`layer ${className}`} style={style} aria-hidden>
      {children}
    </div>
  );
}

