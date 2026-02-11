"use client";

import { useState, useEffect } from "react";
import { SnakeGame } from "./SnakeGame";
import { TapGame } from "./TapGame";
import { CatchGame } from "./CatchGame";
import { NotFoundJokes } from "./NotFoundJokes";

const ITEMS = [
  { type: "game" as const, id: "snake", label: "Snake", Component: SnakeGame },
  { type: "game" as const, id: "tap", label: "Tap race", Component: TapGame },
  { type: "game" as const, id: "catch", label: "Catch the dot", Component: CatchGame },
  { type: "joke" as const, id: "joke", Component: NotFoundJokes },
];

export function NotFoundContent({ onGameOver }: { onGameOver?: () => void } = {}) {
  const [item, setItem] = useState<typeof ITEMS[number] | null>(null);

  useEffect(() => {
    setItem(ITEMS[Math.floor(Math.random() * ITEMS.length)]!);
  }, []);

  if (!item) {
    return (
      <div className="rounded-xl border border-border/50 bg-muted/5 p-8 min-h-[220px] animate-pulse" />
    );
  }

  const { Component } = item;
  return (
    <div>
      {item.type === "game" && (
        <p className="text-[10px] text-muted-foreground mb-2 text-center uppercase tracking-wider">
          {item.label}
        </p>
      )}
      {item.type === "game" ? (
        <Component onGameOver={onGameOver} />
      ) : (
        <Component />
      )}
    </div>
  );
}
