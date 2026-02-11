"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const SIZE = 40;
const MOVE_MS = 600;

export function CatchGame({ onGameOver }: { onGameOver?: () => void } = {}) {
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [playing, setPlaying] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const moveDot = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const maxX = rect.width - SIZE;
    const maxY = rect.height - SIZE;
    setPos({
      x: Math.random() * maxX,
      y: Math.random() * maxY,
    });
  }, []);

  useEffect(() => {
    if (!playing || gameOver) return;
    const id = setInterval(() => {
      moveDot();
    }, MOVE_MS);
    return () => clearInterval(id);
  }, [playing, gameOver, moveDot]);

  const handleHit = () => {
    if (!playing || gameOver) return;
    setScore((s) => s + 1);
    moveDot();
  };

  const handleMiss = () => {
    if (!playing || gameOver) return;
    setGameOver(true);
    onGameOver?.();
  };

  const restart = () => {
    setScore(0);
    setGameOver(false);
    setPlaying(true);
    setPos({ x: 50, y: 50 });
  };

  return (
    <div className="rounded-xl border border-border/50 bg-muted/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-muted-foreground">Score: {score}</span>
        {!playing && (
          <button
            type="button"
            onClick={restart}
            className="text-xs font-medium text-primary hover:underline"
          >
            {gameOver ? "Play again" : "Start"}
          </button>
        )}
      </div>
      <div
        ref={containerRef}
        className="relative mx-auto rounded-lg border border-border/50 bg-muted/20 overflow-hidden"
        style={{ width: 240, height: 200 }}
      >
        {playing && (
          <>
            <div
              className="absolute inset-0 z-0"
              onClick={handleMiss}
              aria-hidden
            />
            <div
              className="absolute z-10 rounded-full bg-primary transition-all duration-75 cursor-pointer hover:scale-110 active:scale-95"
              style={{
                width: SIZE,
                height: SIZE,
                left: pos.x,
                top: pos.y,
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleHit();
              }}
            />
          </>
        )}
        {!playing && !gameOver && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Click Start</p>
          </div>
        )}
        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/95 backdrop-blur">
            <p className="text-lg font-semibold text-foreground">Missed!</p>
            <p className="text-sm text-muted-foreground">Score: {score}</p>
            <button
              type="button"
              onClick={restart}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Play again
            </button>
          </div>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground mt-2 text-center">
        Click the dot before it moves. Don&apos;t miss!
      </p>
    </div>
  );
}
