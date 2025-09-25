"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";
import { InstallButton } from "@/components/install-button";

export default function StickyCta() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only show on homepage; hide on dashboard or other routes
    if (pathname !== "/") return setShow(false);
    // Respect dismissal
    const dismissed = typeof window !== "undefined" && localStorage.getItem("cta_bar") === "off";
    if (dismissed) return setShow(false);

    function onScroll() {
      // Reveal after the user scrolls a bit to avoid stacking with hero
      const threshold = 200;
      setShow(window.scrollY > threshold);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

  function dismiss() {
    setShow(false);
    try { localStorage.setItem("cta_bar", "off"); } catch {}
  }

  useEffect(() => {
    if (show && barRef.current) {
      gsap.fromTo(
        barRef.current,
        { y: -40, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.45, ease: "power3.out" }
      );
    }
  }, [show]);

  if (!show) return null;

  return (
    <div className="fixed top-14 left-0 right-0 z-30" ref={barRef} style={{ willChange: 'transform' }}>
      <div className="container-page">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-lg border border-slate-200 bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-2 text-white shadow-soft dark:border-slate-700">
          <div className="text-sm md:text-base font-medium">Start your 7‑day free trial</div>
          <div className="flex items-center gap-2">
            <InstallButton>Install</InstallButton>
            <a href="/dashboard" className="btn btn-ghost bg-white/10 text-white hover:bg-white/20 dark:bg-transparent">View dashboard</a>
            <button aria-label="Dismiss" onClick={dismiss} className="ml-1 rounded-md bg-white/10 px-2 py-1 text-white hover:bg-white/20">✕</button>
          </div>
        </div>
      </div>
    </div>
  );
}
