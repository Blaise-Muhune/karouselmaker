"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SnakeGame } from "@/components/not-found/SnakeGame";
import { TapGame } from "@/components/not-found/TapGame";
import { CatchGame } from "@/components/not-found/CatchGame";
import { Gamepad2 } from "lucide-react";

const GAMES = [
  { id: "snake" as const, label: "Snake", Component: SnakeGame },
  { id: "tap" as const, label: "Tap race", Component: TapGame },
  { id: "catch" as const, label: "Catch the dot", Component: CatchGame },
] as const;

export function WaitingGamesDialog({
  loadingMessage = "Still loading…",
  triggerClassName,
}: {
  /** Short message shown above the game, e.g. "Your carousel is still generating…" */
  loadingMessage?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [gameIndex, setGameIndex] = useState(0);

  const pickRandomGame = useCallback(() => {
    setGameIndex(Math.floor(Math.random() * GAMES.length));
  }, []);

  const cycleGame = useCallback(() => {
    setGameIndex((i) => (i + 1) % GAMES.length);
  }, []);

  const current = GAMES[gameIndex]!;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={triggerClassName}
          onClick={() => {
            if (!open) pickRandomGame();
          }}
        >
          <Gamepad2 className="mr-2 size-4" />
          Play a game while you wait
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Play a game</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground text-xs text-center -mt-2">
          {loadingMessage}
        </p>
        <div className="rounded-xl border border-border/50 bg-muted/5 p-4 min-h-[240px]">
          <p className="text-[10px] text-muted-foreground mb-2 text-center uppercase tracking-wider">
            {current.label}
          </p>
          <current.Component />
        </div>
        <div className="flex justify-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={cycleGame}
          >
            Different game
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
