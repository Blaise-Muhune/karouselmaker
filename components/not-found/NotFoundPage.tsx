"use client";

import { useState, useCallback } from "react";
import { Link } from "next-view-transitions";
import { NotFoundContent } from "./NotFoundContent";
import { JumpScare } from "./JumpScare";

const PUNCHLINES = [
  "This slide doesn't exist. You swiped too far. 🎠",
  "404: The carousel stopped here.",
  "This page is missing. So are our socks.",
  "You've found the void between slides.",
];

const JUMP_SCARE_CHANCE = 0.2;

export function NotFoundPage() {
  const [punchline] = useState(() => PUNCHLINES[Math.floor(Math.random() * PUNCHLINES.length)]);
  const [jumpScareActive, setJumpScareActive] = useState(false);
  const [pendingNav, setPendingNav] = useState(false);

  const maybeTriggerScare = useCallback((onScare?: () => void) => {
    if (Math.random() < JUMP_SCARE_CHANCE) {
      setJumpScareActive(true);
      onScare?.();
    }
  }, []);

  const handleScareComplete = useCallback(() => {
    setJumpScareActive(false);
    if (pendingNav) {
      setPendingNav(false);
      window.location.href = "/";
    }
  }, [pendingNav]);

  const handleBackClick = (e: React.MouseEvent) => {
    if (Math.random() < JUMP_SCARE_CHANCE) {
      e.preventDefault();
      setPendingNav(true);
      setJumpScareActive(true);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 md:p-8 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))]">
      <JumpScare active={jumpScareActive} onComplete={handleScareComplete} />

      <div className="mx-auto max-w-md w-full space-y-8 text-center">
        <div>
          <h1 className="text-6xl font-bold text-primary/80">404</h1>
          <p className="mt-2 text-lg font-medium text-foreground">
            Oops. This page is gone.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{punchline}</p>
        </div>

        <NotFoundContent onGameOver={() => maybeTriggerScare()} />

        <p className="text-sm text-muted-foreground">
          While you&apos;re here, why not make a real carousel?
        </p>
        <Link
          href="/"
          onClick={handleBackClick}
          className="inline-flex items-center gap-2 text-primary font-medium hover:underline"
        >
          ← Back to safety
        </Link>
      </div>
    </main>
  );
}
