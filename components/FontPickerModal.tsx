"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PREVIEW_FONTS } from "@/components/renderer/SlidePreview";
import { cn } from "@/lib/utils";

/** Font stack for rendering a font option in its typeface (matches SlidePreview / renderSlideHtml). */
export function getFontStack(id: string): string {
  if (id === "Georgia") return "Georgia, serif";
  if (id === "Times New Roman") return '"Times New Roman", Times, serif';
  if (id === "Inter") return "Inter, system-ui, sans-serif";
  if (id === "system" || id === "sans-serif") return "system-ui, -apple-system, sans-serif";
  if (id === "Roboto") return "Roboto, system-ui, sans-serif";
  if (id === "Montserrat") return "Montserrat, system-ui, sans-serif";
  if (id === "Open Sans") return '"Open Sans", system-ui, sans-serif';
  if (id === "Lato") return "Lato, system-ui, sans-serif";
  if (id === "Poppins") return "Poppins, system-ui, sans-serif";
  if (id === "Work Sans") return '"Work Sans", system-ui, sans-serif';
  if (id === "Playfair Display") return '"Playfair Display", Georgia, serif';
  if (id === "Merriweather") return "Merriweather, Georgia, serif";
  if (id === "Libre Baskerville") return '"Libre Baskerville", Georgia, serif';
  if (id === "Source Sans 3") return '"Source Sans 3", system-ui, sans-serif';
  if (id === "Chonburi") return '"Chonburi", Georgia, serif';
  if (id === "Breaking March") return '"Breaking March", Georgia, serif';
  if (id === "Orange Squash Pro") return '"Orange Squash Pro", Georgia, serif';
  if (id === "Bringbold Nineties") return '"Bringbold Nineties", Georgia, serif';
  if (id === "Bouselle") return '"Bouselle", Georgia, serif';
  if (id === "Instrument Serif") return '"Instrument Serif", Georgia, serif';
  if (id === "Bodoni Moda") return '"Bodoni Moda", Georgia, serif';
  if (id === "Prata") return '"Prata", Georgia, serif';
  if (id === "Arapey") return '"Arapey", Georgia, serif';
  if (id === "Fraunces") return '"Fraunces", Georgia, serif';
  if (id === "Abril Fatface") return '"Abril Fatface", Georgia, serif';
  if (id === "Limelight") return '"Limelight", system-ui, sans-serif';
  if (id === "Syne") return '"Syne", system-ui, sans-serif';
  if (id === "Outfit") return '"Outfit", system-ui, sans-serif';
  if (id === "Urbanist") return '"Urbanist", system-ui, sans-serif';
  if (id === "Sora") return '"Sora", system-ui, sans-serif';
  if (id?.trim()) return `${id}, system-ui, sans-serif`;
  return "system-ui, -apple-system, sans-serif";
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
              style={id !== "system" ? { fontFamily: getFontStack(id) } : undefined}
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
