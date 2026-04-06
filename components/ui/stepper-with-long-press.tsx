"use client";

import { useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { MinusIcon, PlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** +/- stepper with long-press: hold to repeat, interval speeds up over time. Same behavior as slide editor. */
export function StepperWithLongPress({
  value,
  min,
  max,
  step,
  onChange,
  formatDisplay = (n) => String(n),
  label,
  className = "",
  valueClassName = "min-w-8",
  disabled = false,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (next: number) => void;
  formatDisplay?: (n: number) => string;
  label: string;
  className?: string;
  valueClassName?: string;
  disabled?: boolean;
}) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const directionRef = useRef<1 | -1 | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    directionRef.current = null;
  }, []);

  const apply = useCallback(
    (dir: 1 | -1) => {
      const current = valueRef.current;
      const next = Math.min(max, Math.max(min, current + dir * step));
      valueRef.current = next;
      onChange(next);
    },
    [min, max, step, onChange]
  );

  const startRepeat = useCallback(
    (dir: 1 | -1) => {
      directionRef.current = dir;
      const startTime = Date.now();
      const run = () => {
        if (directionRef.current !== dir) return;
        apply(dir);
        const elapsed = Date.now() - startTime;
        const delay = elapsed < 400 ? 80 : elapsed < 1000 ? 50 : elapsed < 2000 ? 35 : 20;
        timeoutRef.current = setTimeout(run, delay);
      };
      timeoutRef.current = setTimeout(run, 400);
    },
    [apply]
  );

  const handlePointerDown = useCallback(
    (dir: 1 | -1) => (e: React.PointerEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      apply(dir);
      startRepeat(dir);
    },
    [apply, startRepeat]
  );

  const handlePointerUpOrLeave = useCallback(() => {
    clearTimers();
  }, [clearTimers]);

  useEffect(() => {
    const handlePointerUp = () => clearTimers();
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      clearTimers();
    };
  }, [clearTimers]);

  return (
    <div
      className={cn(
        "flex w-full min-w-0 items-stretch overflow-hidden rounded-md border border-input/80 bg-background divide-x divide-input/80",
        disabled && "pointer-events-none opacity-50",
        className
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="h-7 w-9 shrink-0 flex-none rounded-none border-0 px-0"
        onPointerDown={handlePointerDown(-1)}
        onPointerUp={handlePointerUpOrLeave}
        onPointerLeave={handlePointerUpOrLeave}
        onPointerCancel={handlePointerUpOrLeave}
        aria-label={`Decrease ${label}`}
        disabled={disabled}
      >
        <MinusIcon className="size-3 shrink-0" />
      </Button>
      <span
        className={cn(
          "flex min-h-7 min-w-0 flex-1 items-center justify-center px-1 text-center text-xs font-medium tabular-nums leading-none",
          valueClassName
        )}
        aria-hidden
      >
        {formatDisplay(value)}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="h-7 w-9 shrink-0 flex-none rounded-none border-0 px-0"
        onPointerDown={handlePointerDown(1)}
        onPointerUp={handlePointerUpOrLeave}
        onPointerLeave={handlePointerUpOrLeave}
        onPointerCancel={handlePointerUpOrLeave}
        aria-label={`Increase ${label}`}
        disabled={disabled}
      >
        <PlusIcon className="size-3 shrink-0" />
      </Button>
    </div>
  );
}
