"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserRoundIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveUgcCharacterBriefFromCarousel } from "@/app/actions/projects/projectUgcCharacterActions";

/**
 * Promotes this carousel’s AI-generated recurring look into the project (text lock + anchor frames).
 * Parent should render only when promotion is allowed (see carousel page eligibility).
 */
export function SaveUgcCharacterFromCarouselButton({
  projectId,
  carouselId,
  hasExistingSavedBrief,
}: {
  projectId: string;
  carouselId: string;
  /** When true, label reads "Update…" instead of "Save…". */
  hasExistingSavedBrief: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3 space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 min-w-0">
          <UserRoundIcon className="size-5 shrink-0 text-muted-foreground mt-0.5" aria-hidden />
          <div className="min-w-0 space-y-1">
            <p className="text-sm text-muted-foreground leading-snug">
              <span className="text-foreground font-medium">Promote this carousel’s AI look</span> to your project: we
              copy a text lock and a few anchor frames into your library for the next run (same person, animal, mascot,
              object, or other repeated entity).
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="shrink-0"
          disabled={pending}
          onClick={() => {
            setMessage(null);
            startTransition(async () => {
              const r = await saveUgcCharacterBriefFromCarousel(projectId, carouselId);
              if (r.ok) {
                setMessage({
                  type: "ok",
                  text: hasExistingSavedBrief
                    ? "Recurring entity lock and anchor references updated for future carousels."
                    : "Recurring entity lock and anchor references saved for future carousels.",
                });
                router.refresh();
              } else {
                setMessage({ type: "err", text: r.error });
              }
            });
          }}
        >
          {pending ? "Saving…" : hasExistingSavedBrief ? "Update saved character" : "Promote to project"}
        </Button>
      </div>
      {message && (
        <p className={`text-xs ${message.type === "ok" ? "text-green-700 dark:text-green-400" : "text-destructive"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
