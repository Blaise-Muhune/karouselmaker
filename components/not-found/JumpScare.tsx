"use client";

import { useEffect, useState } from "react";

const SCARES = [
  { text: "BOO!", emoji: "👻" },
  { text: "NOPE.", emoji: "😱" },
  { text: "404 GOT YOU", emoji: "🕷️" },
  { text: "THE VOID", emoji: "🐍" },
  { text: "RUN.", emoji: "💀" },
];

const DURATION_MS = 450;

export function JumpScare({
  active,
  onComplete,
}: {
  active: boolean;
  onComplete: () => void;
}) {
  const [scare, setScare] = useState(() => SCARES[Math.floor(Math.random() * SCARES.length)]!);

  useEffect(() => {
    if (active) setScare(SCARES[Math.floor(Math.random() * SCARES.length)]!);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const id = setTimeout(onComplete, DURATION_MS);
    return () => clearTimeout(id);
  }, [active, onComplete]);

  if (!active || !scare) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black animate-in fade-in duration-75"
      aria-hidden
    >
      <div className="text-center animate-in zoom-in-95 duration-100 text-red-500 [text-shadow:0_0_30px_rgba(255,0,0,0.6)]">
        <p className="text-5xl md:text-7xl font-black text-red-500 tracking-tighter">
          {scare.text}
        </p>
        <p className="text-6xl md:text-8xl mt-2 animate-bounce">{scare.emoji}</p>
      </div>
    </div>
  );
}
