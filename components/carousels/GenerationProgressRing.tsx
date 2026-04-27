"use client";

import { useEffect, useMemo, useState } from "react";

export function GenerationProgressRing({
  durationMs = 5 * 60 * 1000,
  size = 56,
  stroke = 5,
}: {
  durationMs?: number;
  size?: number;
  stroke?: number;
}) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const id = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setElapsedMs(Math.min(durationMs, elapsed));
    }, 500);
    return () => window.clearInterval(id);
  }, [durationMs]);

  const progress = useMemo(() => {
    if (durationMs <= 0) return 1;
    return Math.max(0, Math.min(1, elapsedMs / durationMs));
  }, [durationMs, elapsedMs]);

  const percent = Math.round(progress * 100);
  const trackColor = "hsl(var(--muted))";
  const fillColor = "hsl(var(--primary))";
  const innerSize = Math.max(size - stroke * 2, 0);

  return (
    <div
      className="mx-auto grid place-items-center rounded-full"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        background: `conic-gradient(${fillColor} ${progress * 360}deg, ${trackColor} 0deg)`,
      }}
      role="img"
      aria-label={`Loading progress ${percent}%`}
    >
      <div
        className="grid place-items-center rounded-full bg-background text-[11px] font-medium text-foreground"
        style={{ width: `${innerSize}px`, height: `${innerSize}px` }}
      >
        {percent}%
      </div>
    </div>
  );
}
