"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserRoundIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveUgcCharacterBriefFromCarousel } from "@/app/actions/projects/projectUgcCharacterActions";

export function SaveUgcCharacterFromCarouselButton({
  projectId,
  carouselId,
  hasExistingSavedBrief,
  canSave,
  disabledHint,
}: {
  projectId: string;
  carouselId: string;
  /** When true, label reads "Update…" instead of "Save…". */
  hasExistingSavedBrief: boolean;
  /** When false, the button is disabled and `disabledHint` explains why. */
  canSave: boolean;
  disabledHint: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  return (
    <div
      className={`rounded-lg border border-border/60 bg-muted/20 px-4 py-3 space-y-2 ${!canSave ? "opacity-90" : ""}`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 min-w-0">
          <UserRoundIcon className="size-5 shrink-0 text-muted-foreground mt-0.5" aria-hidden />
          <div className="min-w-0 space-y-1">
            <p className="text-sm text-muted-foreground leading-snug">
              {canSave ? (
                <>
                  Save this carousel’s <span className="text-foreground font-medium">AI character</span> to the
                  project: we copy the text lock and a few slide images (face-friendly frames) into your library for the
                  next run.
                </>
              ) : (
                <>
                  When a carousel is built with <span className="text-foreground font-medium">AI images</span> (Instagram /
                  TikTok) and <span className="text-foreground font-medium">without</span> your project’s saved face
                  photos, you can save that character here for reuse.
                </>
              )}
            </p>
            {!canSave && disabledHint ? (
              <p className="text-xs text-muted-foreground leading-snug">{disabledHint}</p>
            ) : null}
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="shrink-0"
          disabled={pending || !canSave}
          title={!canSave ? disabledHint : undefined}
          onClick={() => {
            if (!canSave) return;
            setMessage(null);
            startTransition(async () => {
              const r = await saveUgcCharacterBriefFromCarousel(projectId, carouselId);
              if (r.ok) {
                setMessage({
                  type: "ok",
                  text: hasExistingSavedBrief
                    ? "Character and face references updated for future carousels."
                    : "Character and face references saved for future carousels.",
                });
                router.refresh();
              } else {
                setMessage({ type: "err", text: r.error });
              }
            });
          }}
        >
          {pending ? "Saving…" : hasExistingSavedBrief ? "Update saved character" : "Save character for future carousels"}
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
