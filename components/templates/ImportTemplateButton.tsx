"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ImportTemplateFromImageDialog } from "@/components/templates/ImportTemplateFromImageDialog";
import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * When true, import-from-image is visible but disabled everywhere until you flip this.
 */
export const TEMPLATE_IMPORT_FROM_IMAGE_COMING_SOON = true;

export type ImportTemplateButtonProps = {
  /** When provided (e.g. in Choose template modal), new template is passed here and we don’t navigate to edit. */
  onSuccess?: (templateId: string, name: string, config: TemplateConfig, referenceAssetId?: string) => void;
  onCreated?: () => void;
  isPro?: boolean;
  atLimit?: boolean;
  /** When true, import dialog shows AI suggestions (suggested font, etc.). */
  isAdmin?: boolean;
  /** Project watermark text (username). When set, preview shows it in the watermark slot when template has no logo. */
  watermarkText?: string;
  variant?: "default" | "outline" | "ghost" | "link" | "secondary" | "destructive";
  size?: "default" | "sm" | "lg" | "icon" | "icon-sm";
  className?: string;
  children?: React.ReactNode;
  /** Visible but non-interactive; shows “coming soon” (defaults from {@link TEMPLATE_IMPORT_FROM_IMAGE_COMING_SOON}). */
  comingSoon?: boolean;
  /** `callout` = full-width banner for template modals; `button` = compact control. */
  layout?: "button" | "callout";
};

export function ImportTemplateButton({
  onSuccess,
  onCreated,
  isPro = true,
  atLimit = false,
  isAdmin = false,
  watermarkText,
  variant = "outline",
  size = "sm",
  className,
  children,
  comingSoon = TEMPLATE_IMPORT_FROM_IMAGE_COMING_SOON,
  layout = "button",
}: ImportTemplateButtonProps) {
  const [open, setOpen] = useState(false);

  if (layout === "callout") {
    if (comingSoon) {
      return (
        <div
          className={cn(
            "rounded-lg border border-dashed border-primary/25 bg-primary/[0.04] px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4",
            className
          )}
          role="status"
          aria-label="Import template from image — coming soon"
        >
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
              <ImageIcon className="size-6 text-primary" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">Import from image</p>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border border-border rounded-md px-2 py-0.5 bg-muted/40">
                  Coming soon
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-snug">
                Upload a slide screenshot and we&apos;ll generate a matching template.{" "}
                {!isPro ? "Pro only when this ships." : "In development — check back soon."}
              </p>
            </div>
          </div>
          <Button type="button" variant="secondary" size="sm" className="shrink-0 w-full sm:w-auto" disabled>
            In development
          </Button>
        </div>
      );
    }
    return (
      <div
        className={cn(
          "rounded-lg border border-border/80 bg-muted/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4",
          className
        )}
      >
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
            <ImageIcon className="size-6 text-primary" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold text-foreground">Import from image</p>
            <p className="text-xs text-muted-foreground leading-snug">
              Upload a slide screenshot; we&apos;ll infer layout and styles into a new template.{!isPro ? " Pro required." : ""}
            </p>
          </div>
        </div>
        <ImportTemplateButton
          onSuccess={onSuccess}
          onCreated={onCreated}
          isPro={isPro}
          atLimit={atLimit}
          isAdmin={isAdmin}
          watermarkText={watermarkText}
          variant={variant}
          size={size}
          comingSoon={false}
          layout="button"
          className="shrink-0 w-full sm:w-auto"
        />
      </div>
    );
  }

  if (comingSoon) {
    return (
      <Button
        type="button"
        variant={variant}
        size={size}
        className={cn("gap-1.5 shrink-0", className)}
        disabled
        title="Coming soon — import from image is in development"
      >
        {children ?? (
          <>
            <ImageIcon className="size-3.5 shrink-0" />
            <span>Import from image</span>
            <span className="text-[10px] font-medium text-muted-foreground normal-case">Soon</span>
          </>
        )}
      </Button>
    );
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => setOpen(true)}
        disabled={!isPro || atLimit}
        title={atLimit ? "Template limit reached" : !isPro ? "Pro required" : "Import template from an image"}
      >
        {children ?? (
          <>
            <ImageIcon className="size-3.5" />
            Import from image
          </>
        )}
      </Button>
      <ImportTemplateFromImageDialog
        open={open}
        onOpenChange={setOpen}
        onSuccess={onSuccess}
        onCreated={onCreated}
        isPro={isPro}
        atLimit={atLimit}
        isAdmin={isAdmin}
        watermarkText={watermarkText}
      />
    </>
  );
}
