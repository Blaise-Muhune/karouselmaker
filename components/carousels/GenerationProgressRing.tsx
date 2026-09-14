"use client";

import { CheckIcon, Loader2Icon } from "lucide-react";

export type GenerationPhase = "queued" | "writing" | "assembling" | "visuals" | "finishing" | "complete";

const STEPS: { phase: Exclude<GenerationPhase, "queued" | "complete">; label: string }[] = [
  { phase: "writing", label: "Write your post" },
  { phase: "assembling", label: "Build the slides" },
  { phase: "visuals", label: "Prepare the visuals" },
  { phase: "finishing", label: "Apply final details" },
];

const PHASE_COPY: Record<GenerationPhase, string> = {
  queued: "Starting your carousel…",
  writing: "Writing the carousel…",
  assembling: "Building your slides…",
  visuals: "Preparing the visuals…",
  finishing: "Applying the final details…",
  complete: "Your carousel is ready",
};

export function generationPhaseCopy(phase: GenerationPhase) {
  return PHASE_COPY[phase];
}

/** Shows work that has actually completed; it intentionally does not estimate a fake percentage. */
export function GenerationProgress({ phase = "queued" }: { phase?: GenerationPhase }) {
  const activeIndex = phase === "queued" ? 0 : Math.max(0, STEPS.findIndex((step) => step.phase === phase));
  const completedCount = phase === "complete" ? STEPS.length : activeIndex;

  return (
    <ol className="grid grid-cols-2 gap-x-3 gap-y-2 text-left" aria-label="Carousel generation progress">
      {STEPS.map((step, index) => {
        const completed = index < completedCount;
        const active = index === activeIndex && phase !== "complete";
        return (
          <li key={step.phase} className="flex min-w-0 items-center gap-2 text-xs">
            <span
              className={
                "grid size-5 shrink-0 place-items-center rounded-full border " +
                (completed
                  ? "border-primary bg-primary text-primary-foreground"
                  : active
                    ? "border-primary/60 text-primary"
                    : "border-border text-muted-foreground")
              }
              aria-hidden
            >
              {completed ? <CheckIcon className="size-3" /> : active ? <Loader2Icon className="size-3 animate-spin" /> : index + 1}
            </span>
            <span className={completed || active ? "text-foreground" : "text-muted-foreground"}>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function GenerationProgressRing({ size = 56, stroke = 5 }: {
  durationMs?: number;
  size?: number;
  stroke?: number;
}) {
  const trackColor = "hsl(var(--muted))";
  const fillColor = "hsl(var(--primary))";

  return (
    <div
      className="mx-auto grid place-items-center rounded-full animate-spin"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderWidth: `${stroke}px`,
        borderStyle: "solid",
        borderColor: trackColor,
        borderTopColor: fillColor,
      }}
      role="img"
      aria-label="Generation in progress"
    />
  );
}
