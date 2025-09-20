"use client";
import { useMemo } from "react";

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

export default function Sparkles({ count = 42 }: { count?: number }) {
  const stars = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        left: rand(0, 100),
        top: rand(0, 100),
        size: rand(1.5, 3.5),
        dur: rand(3.5, 6.5),
        delay: rand(0, 4),
      })),
    [count]
  );

  return (
    <div className="fx-stars" aria-hidden>
      {stars.map((s, i) => (
        <span
          key={i}
          className="fx-star"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            animationDelay: `${s.delay}s`,
            ['--dur' as any]: `${s.dur}s`,
          }}
        />
      ))}
    </div>
  );
}

