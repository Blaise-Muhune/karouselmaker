"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ImportTemplateFromImageDialog } from "@/components/templates/ImportTemplateFromImageDialog";
import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";
import { ImageIcon } from "lucide-react";

export type ImportTemplateButtonProps = {
  /** When provided (e.g. in Choose template modal), new template is passed here and we don’t navigate to edit. */
  onSuccess?: (templateId: string, name: string, config: TemplateConfig) => void;
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
}: ImportTemplateButtonProps) {
  const [open, setOpen] = useState(false);
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
