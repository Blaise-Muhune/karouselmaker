"use client";

import type { ReactNode } from "react";
import { Loader2Icon } from "lucide-react";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Shared `DialogContent` sizing for template pickers (slide editor, carousel grid, new carousel). */
export const CHOOSE_TEMPLATE_MODAL_DIALOG_CONTENT_CLASS =
  "flex flex-col min-h-0 overflow-hidden max-w-[calc(100%-2rem)] max-h-[85vh] sm:max-w-2xl md:max-w-[92vw] md:max-h-[92vh] md:w-[92vw] md:h-[92vh] lg:max-w-[94vw] lg:max-h-[94vh] lg:w-[94vw] lg:h-[94vh]";

/** Keep all template pickers consistent before first Load more. */
export const CHOOSE_TEMPLATE_MODAL_INITIAL_VISIBLE_COUNT = 36;
/** Keep Load more button style consistent across template pickers. */
export const CHOOSE_TEMPLATE_MODAL_EMPHASIZE_LOAD_MORE = true;

export type ChooseTemplateModalLayoutProps = {
  title: string;
  description?: ReactNode;
  /** e.g. `ImportTemplateButton` with `layout="callout"` */
  topActions?: ReactNode;
  /**
   * Optional strip above the template grid (e.g. new-carousel first/middle/last slots).
   * Omit on single-slide pickers (editor, grid).
   */
  toolbar?: ReactNode;
  children: ReactNode;
  applying?: boolean;
  applyingTitle?: string;
  applyingHint?: ReactNode;
  /** Raise overlay above nested portaled content (e.g. carousel grid). */
  applyingOverlayClassName?: string;
};

export function ChooseTemplateModalLayout({
  title,
  description,
  topActions,
  toolbar,
  children,
  applying,
  applyingTitle = "Applying template…",
  applyingHint,
  applyingOverlayClassName,
}: ChooseTemplateModalLayoutProps) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description != null && description !== false ? (
          typeof description === "string" ? (
            <p className="text-muted-foreground text-sm mt-1">{description}</p>
          ) : (
            <div className="text-muted-foreground text-sm mt-1">{description}</div>
          )
        ) : null}
      </DialogHeader>
      {topActions ? <div className="shrink-0 hidden md:block">{topActions}</div> : null}
      {toolbar ? <div className="shrink-0">{toolbar}</div> : null}
      <div className="relative flex flex-1 min-h-0 min-w-0 flex-col">
        {applying ? (
          <div
            className={cn(
              "absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-lg bg-background/95 backdrop-blur-sm px-6 text-center",
              applyingOverlayClassName
            )}
            role="status"
            aria-live="polite"
            aria-label={typeof applyingTitle === "string" ? applyingTitle : "Applying template"}
          >
            <Loader2Icon className="size-10 shrink-0 animate-spin text-primary" aria-hidden />
            <p className="text-sm font-medium text-foreground">{applyingTitle}</p>
            {applyingHint != null && applyingHint !== false ? (
              typeof applyingHint === "string" ? (
                <p className="max-w-xs text-xs text-muted-foreground">{applyingHint}</p>
              ) : (
                <div className="max-w-xs text-xs text-muted-foreground">{applyingHint}</div>
              )
            ) : null}
          </div>
        ) : null}
        <div className="min-h-0 min-w-0 flex-1 w-full overflow-x-hidden overflow-y-auto pr-1">{children}</div>
      </div>
    </>
  );
}
