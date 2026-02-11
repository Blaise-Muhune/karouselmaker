"use client";

import { useState, useEffect, useCallback } from "react";


const DURATION = 5;

export function TapGame({ onGameOver }: { onGameOver?: () => void } = {}) {
  const [taps, setTaps] = useState(0);
  const [phase, setPhase] = useState<"idle" | "countdown" | "playing" | "done">("idle");
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (phase === "countdown") {
      if (countdown <= 0) {
        setPhase("playing");
        setTimeLeft(DURATION);
        return;
      }
      const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(id);
    }
  }, [phase, countdown]);

  useEffect(() => {
    if (phase === "done") onGameOver?.();
  }, [phase, onGameOver]);

  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 0.1) {
          setPhase("done");
          return 0;
        }
        return t - 0.1;
      });
    }, 100);
    return () => clearInterval(id);
  }, [phase]);

  const start = useCallback(() => {
    setTaps(0);
    setPhase("countdown");
    setCountdown(3);
  }, []);

  const restart = useCallback(() => {
    setTaps(0);
    setPhase("countdown");
    setCountdown(3);
  }, []);

  return (
    <div className="rounded-xl border border-border/50 bg-muted/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-muted-foreground">Taps: {taps}</span>
        {phase === "playing" && (
          <span className="text-sm font-medium text-primary">{timeLeft.toFixed(1)}s</span>
        )}
        {phase === "idle" && (
          <button
            type="button"
            onClick={start}
            className="text-xs font-medium text-primary hover:underline"
          >
            Start
          </button>
        )}
      </div>
      <div
        className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border/50 bg-muted/10 min-h-[200px] cursor-pointer select-none touch-none transition-colors hover:border-primary/30 active:scale-[0.98]"
        onClick={() => {
          if (phase === "playing") setTaps((t) => t + 1);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (phase === "playing" && (e.key === " " || e.key === "Enter")) {
            e.preventDefault();
            setTaps((t) => t + 1);
          }
        }}
      >
        {phase === "idle" && (
          <p className="text-sm text-muted-foreground">Tap to start</p>
        )}
        {phase === "countdown" && (
          <p className="text-4xl font-bold text-primary">{countdown || "GO!"}</p>
        )}
        {phase === "playing" && (
          <p className="text-lg font-medium text-foreground">TAP TAP TAP!</p>
        )}
        {phase === "done" && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-lg font-semibold text-foreground">Time&apos;s up!</p>
            <p className="text-2xl font-bold text-primary">{taps} taps</p>
            <button
              type="button"
              onClick={restart}
              className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Play again
            </button>
          </div>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground mt-2 text-center">
        {phase === "playing" ? "Click or tap as fast as you can!" : "5 seconds — how many taps?"}
      </p>
    </div>
  );
}
