"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PREVIEW_FONTS } from "@/lib/constants/previewFonts";
import { getFontFamilyStack } from "@/lib/renderer/fontFamilyStack";
import { cn } from "@/lib/utils";

/** Font stack for rendering a font option in its typeface (matches SlidePreview / renderSlideHtml). */
export function getFontStack(id: string): string {
  return getFontFamilyStack(id);
}

export type FontPickerModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onSelect: (fontId: string) => void;
  title?: string;
};

export function FontPickerModal({
  open,
  onOpenChange,
  value,
  onSelect,
  title = "Choose font",
}: FontPickerModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 overflow-y-auto py-1 -mx-1 pr-1">
          {PREVIEW_FONTS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={cn(
                "rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors",
                (value || "system") === id
                  ? "border-primary bg-primary/15 text-primary-foreground"
                  : "border-border bg-muted/30 hover:bg-muted"
              )}
              style={{ fontFamily: getFontStack(id) }}
              onClick={() => {
                onSelect(id);
                onOpenChange(false);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
