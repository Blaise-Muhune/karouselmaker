"use client";

import Link from "next/link";
import { CheckIcon, FolderPlusIcon, SparklesIcon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Step = {
  id: string;
  label: string;
  done: boolean;
  href?: string;
  detail?: string;
};

/** First-run checklist for the workspace — disappears once the core loop is complete. */
export function WorkspaceOnboarding({
  hasProject,
  hasCarousel,
  hasTikTokConnected,
  firstProjectId,
}: {
  hasProject: boolean;
  hasCarousel: boolean;
  hasTikTokConnected: boolean;
  firstProjectId: string | null;
}) {
  const steps: Step[] = [
    {
      id: "project",
      label: "Create a project",
      done: hasProject,
      href: "/projects/new",
      detail: "Niche + offer once",
    },
    {
      id: "carousel",
      label: "Generate a carousel",
      done: hasCarousel,
      href: firstProjectId ? `/p/${firstProjectId}` : "/projects/new",
      detail: "AI drafts the slides",
    },
    {
      id: "share",
      label: "Export or post",
      done: hasTikTokConnected && hasCarousel,
      href: firstProjectId ? `/p/${firstProjectId}` : undefined,
      detail: hasTikTokConnected
        ? "Open a post → TikTok or Instagram"
        : "Connect TikTok or Instagram when ready",
    },
  ];

  if (steps.every((s) => s.done)) return null;

  return (
    <section className="rounded-2xl border border-primary/25 bg-primary/[0.04] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold tracking-tight text-foreground">Get your first post out</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Three steps. Skip social connect if you only want to download for now.
          </p>
        </div>
        <SparklesIcon className="size-4 shrink-0 text-primary" />
      </div>
      <ol className="mt-4 space-y-2">
        {steps.map((step, index) => (
          <li key={step.id}>
            <div
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3 py-2.5",
                step.done ? "border-border/50 bg-background/40" : "border-border/70 bg-card"
              )}
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  step.done ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground"
                )}
              >
                {step.done ? <CheckIcon className="size-3.5" strokeWidth={3} /> : index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm font-medium", step.done && "text-muted-foreground line-through")}>{step.label}</p>
                {step.detail ? <p className="text-[11px] text-muted-foreground">{step.detail}</p> : null}
              </div>
              {!step.done && step.href ? (
                <Button type="button" size="sm" variant={index === 0 ? "default" : "outline"} className="h-8 shrink-0" asChild>
                  <Link href={step.href}>
                    {step.id === "project" ? <FolderPlusIcon className="mr-1.5 size-3.5" /> : null}
                    {step.id === "carousel" ? <SparklesIcon className="mr-1.5 size-3.5" /> : null}
                    {step.id === "share" ? <UploadIcon className="mr-1.5 size-3.5" /> : null}
                    Go
                  </Link>
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
