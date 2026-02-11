"use client";

import { useState, useEffect, useCallback } from "react";

const GRID = 12;
const INITIAL_SPEED = 180;

type Dir = "up" | "down" | "left" | "right";

export function NotFoundGame() {
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
    const id = setInterval(move, Math.max(100, INITIAL_SPEED - score * 5));
    return () => clearInterval(id);
  }, [dir, playing, gameOver, food, score, placeFoodAvoiding]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" && dir !== "down") setDir("up");
      else if (e.key === "ArrowDown" && dir !== "up") setDir("down");
      else if (e.key === "ArrowLeft" && dir !== "right") setDir("left");
      else if (e.key === "ArrowRight" && dir !== "left") setDir("right");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dir]);

  const start = () => {
    setSnake([[5, 5]]);
    setFood([8, 8]);
    setDir("right");
    setGameOver(false);
    setScore(0);
    setPlaying(true);
  };

  const bodySet = new Set(snake.map(([x, y]) => `${x},${y}`));

  return (
    <div className="rounded-xl border border-border/50 bg-muted/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-muted-foreground">Score: {score}</span>
        {!playing && (
          <button
            type="button"
            onClick={start}
            className="text-xs font-medium text-primary hover:underline"
          >
            {gameOver ? "Play again" : "Start"}
          </button>
        )}
      </div>
      <div
        className="grid gap-0.5 mx-auto rounded-lg overflow-hidden border border-border/50 bg-muted/20"
        style={{
          gridTemplateColumns: `repeat(${GRID}, minmax(0, 1fr))`,
          width: GRID * 20,
          height: GRID * 20,
        }}
      >
        {Array.from({ length: GRID * GRID }, (_, i) => {
          const x = i % GRID;
          const y = Math.floor(i / GRID);
          const isSnake = bodySet.has(`${x},${y}`);
          const isFood = food[0] === x && food[1] === y;
          return (
            <div
              key={i}
              className="w-full aspect-square"
              style={{
                backgroundColor: isSnake
                  ? "oklch(0.55 0.17 163)"
                  : isFood
                    ? "oklch(0.7 0.2 45)"
                    : "transparent",
                borderRadius: 2,
              }}
            />
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground mt-2 text-center">
        Use arrow keys ← ↑ → ↓
      </p>
    </div>
  );
}
