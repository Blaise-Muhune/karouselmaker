"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const GRID = 12;
const INITIAL_SPEED = 180;

type Dir = "up" | "down" | "left" | "right";

export function SnakeGame({ onGameOver }: { onGameOver?: () => void } = {}) {
  const [snake, setSnake] = useState<[number, number][]>([[5, 5]]);
  const [food, setFood] = useState<[number, number]>([8, 8]);
  const [dir, setDir] = useState<Dir>("right");
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [playing, setPlaying] = useState(false);

  const placeFoodAvoiding = useCallback((snakeBody: [number, number][]) => {
    const bodySet = new Set(snakeBody.map(([x, y]) => `${x},${y}`));
    let newFood: [number, number];
    do {
      newFood = [
        Math.floor(Math.random() * GRID),
        Math.floor(Math.random() * GRID),
      ];
    } while (bodySet.has(`${newFood[0]},${newFood[1]}`));
    setFood(newFood);
  }, []);

  useEffect(() => {
    if (!playing || gameOver) return;
    const move = () => {
      setSnake((s) => {
        const head = s[0];
        if (!head) return s;
        let next: [number, number];
        switch (dir) {
          case "up":
            next = [head[0], (head[1] - 1 + GRID) % GRID];
            break;
          case "down":
            next = [head[0], (head[1] + 1) % GRID];
            break;
          case "left":
            next = [(head[0] - 1 + GRID) % GRID, head[1]];
            break;
          default:
            next = [(head[0] + 1) % GRID, head[1]];
        }
        const bodySet = new Set(s.slice(0, -1).map(([x, y]) => `${x},${y}`));
        if (bodySet.has(`${next[0]},${next[1]}`)) {
          setGameOver(true);
          return s;
        }
        const eating = next[0] === food[0] && next[1] === food[1];
        const newSnake = eating ? [next, ...s] : [next, ...s.slice(0, -1)];
        if (eating) {
          setScore((sc) => sc + 1);
          placeFoodAvoiding(newSnake);
        }
        return newSnake;
      });
    };
    const id = setInterval(move, Math.max(80, INITIAL_SPEED - score * 6));
    return () => clearInterval(id);
  }, [dir, playing, gameOver, food, score, placeFoodAvoiding]);

  const setDirSafe = useCallback((next: Dir) => {
    setDir((d) => {
      if (next === "up" && d !== "down") return "up";
      if (next === "down" && d !== "up") return "down";
      if (next === "left" && d !== "right") return "left";
      if (next === "right" && d !== "left") return "right";
      return d;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") setDirSafe("up");
      else if (e.key === "ArrowDown") setDirSafe("down");
      else if (e.key === "ArrowLeft") setDirSafe("left");
      else if (e.key === "ArrowRight") setDirSafe("right");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setDirSafe]);

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const MIN_SWIPE = 30;

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (t) touchStartRef.current = { x: t.clientX, y: t.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const end = e.changedTouches[0];
    if (!end) return;
    const dx = end.clientX - start.x;
    const dy = end.clientY - start.y;
    if (Math.abs(dx) < MIN_SWIPE && Math.abs(dy) < MIN_SWIPE) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      setDirSafe(dx > 0 ? "right" : "left");
    } else {
      setDirSafe(dy > 0 ? "down" : "up");
    }
  };

  useEffect(() => {
    if (gameOver) onGameOver?.();
  }, [gameOver, onGameOver]);

  const restart = () => {
    setSnake([[5, 5]]);
    setFood([8, 8]);
    setDir("right");
    setGameOver(false);
    setScore(0);
    setPlaying(true);
  };

  const bodySet = new Set(snake.map(([x, y]) => `${x},${y}`));

  return (
    <div className="relative rounded-xl border border-border/50 bg-muted/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-muted-foreground">Score: {score}</span>
        {!playing && !gameOver && (
          <button
            type="button"
            onClick={restart}
            className="text-xs font-medium text-primary hover:underline"
          >
            Start
          </button>
        )}
      </div>
      <div className="relative">
        <div
          className="grid gap-0.5 mx-auto rounded-lg overflow-hidden border border-border/50 bg-muted/20 touch-none select-none"
          style={{
            gridTemplateColumns: `repeat(${GRID}, minmax(0, 1fr))`,
            width: GRID * 22,
            height: GRID * 22,
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {Array.from({ length: GRID * GRID }, (_, i) => {
            const x = i % GRID;
            const y = Math.floor(i / GRID);
            const isHead = snake[0]?.[0] === x && snake[0]?.[1] === y;
            const isSnake = bodySet.has(`${x},${y}`);
            const isFood = food[0] === x && food[1] === y;
            return (
              <div
                key={i}
                className="w-full aspect-square transition-colors duration-75"
                style={{
                  backgroundColor: isHead
                    ? "oklch(0.5 0.2 163)"
                    : isSnake
                      ? "oklch(0.55 0.17 163 / 0.9)"
                      : isFood
                        ? "oklch(0.75 0.2 45)"
                        : "transparent",
                  borderRadius: isHead ? 4 : 2,
                }}
              />
            );
          })}
        </div>
        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-background/95 backdrop-blur min-h-[200px]">
            <p className="text-lg font-semibold text-foreground">Game over!</p>
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
      <div className="mt-3 flex flex-col items-center gap-2">
        <p className="text-[10px] text-muted-foreground text-center">
          Swipe or arrow keys
        </p>
        <div className="grid grid-cols-3 gap-1 place-items-center">
          <div />
          <button
            type="button"
            aria-label="Up"
            className="w-10 h-10 rounded-md bg-muted/60 hover:bg-muted flex items-center justify-center active:scale-95 transition-colors touch-manipulation"
            onClick={() => setDirSafe("up")}
          >
            <span className="text-lg">↑</span>
          </button>
          <div />
          <button
            type="button"
            aria-label="Left"
            className="w-10 h-10 rounded-md bg-muted/60 hover:bg-muted flex items-center justify-center active:scale-95 transition-colors touch-manipulation"
            onClick={() => setDirSafe("left")}
          >
            <span className="text-lg">←</span>
          </button>
          <div className="w-10 h-10" />
          <button
            type="button"
            aria-label="Right"
            className="w-10 h-10 rounded-md bg-muted/60 hover:bg-muted flex items-center justify-center active:scale-95 transition-colors touch-manipulation"
            onClick={() => setDirSafe("right")}
          >
            <span className="text-lg">→</span>
          </button>
          <div />
          <button
            type="button"
            aria-label="Down"
            className="w-10 h-10 rounded-md bg-muted/60 hover:bg-muted flex items-center justify-center active:scale-95 transition-colors touch-manipulation"
            onClick={() => setDirSafe("down")}
          >
            <span className="text-lg">↓</span>
          </button>
          <div />
        </div>
      </div>
    </div>
  );
}
