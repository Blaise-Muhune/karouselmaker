"use client";

import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  HIGHLIGHT_COLORS,
  type HighlightSpan,
} from "@/lib/editor/inlineFormat";
import { CopyIcon, Loader2Icon, XIcon } from "lucide-react";

type HighlightModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: "headline" | "body";
  title: string;
  value: string;
  onChange: (value: string) => void;
  highlights: HighlightSpan[];
  highlightColor: string;
  onHighlightColorChange: (color: string) => void;
  highlightStyle: "text" | "background" | "outline";
  onHighlightStyleChange: (style: "text" | "background" | "outline") => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onSaveSelection: () => void;
  onApplyToSelection: (color: string, useSaved: boolean) => void;
  onRemoveFromSelection: (useSaved: boolean) => void;
  onAuto: () => void;
  onApplyToAll: () => void;
  onClearAll: () => void;
  lastHighlightAction: "auto" | "manual";
  totalSlides: number;
  applyingAutoHighlights: boolean;
  /** When true, render only the form content (no Dialog); used when rendering inside a portal below the live preview. */
  contentOnly?: boolean;
};

export function HighlightModal({
  open,
  onOpenChange,
  target,
  title,
  value,
  onChange,
  highlights,
  highlightColor,
  onHighlightColorChange,
  highlightStyle,
  onHighlightStyleChange,
  textareaRef,
  onSaveSelection,
  onApplyToSelection,
  onRemoveFromSelection,
  onAuto,
  onApplyToAll,
  onClearAll,
  lastHighlightAction,
  totalSlides,
  applyingAutoHighlights,
  contentOnly = false,
}: HighlightModalProps) {
  useEffect(() => {
    if (open && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [open, textareaRef]);

  if (contentOnly) {
    if (!open) return null;
    return (
      <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto flex flex-col bg-background border border-border/50 rounded-lg shadow-lg p-4 gap-4">
        <div className="flex items-center justify-between gap-2 shrink-0">
          <h2 className="text-base font-semibold leading-none truncate min-w-0">{title}</h2>
          <div className="flex items-center gap-2 shrink-0">
            {(highlights.length > 0 || (totalSlides > 1 && lastHighlightAction === "auto")) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs shrink-0"
                onClick={onApplyToAll}
                disabled={applyingAutoHighlights}
                title={
                  lastHighlightAction === "auto" && totalSlides > 1
                    ? target === "headline"
                      ? "Run Auto on headlines for every slide"
                      : "Run Auto on body for every slide"
                    : "Apply current color to all highlights in this field"
                }
              >
                {applyingAutoHighlights ? (
                  <Loader2Icon className="size-3.5 animate-spin" />
                ) : (
                  <CopyIcon className="size-3.5" />
                )}{" "}
                Apply to all highlights
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={() => onOpenChange(false)} aria-label="Close">
              <XIcon className="size-4" />
            </Button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed shrink-0">
          Select text in the box below, then pick a color (or Auto to highlight key words). Use No color to remove a highlight. You can see the result in the live preview above. If you just used Auto, "Apply to all highlights" runs Auto on every slide; otherwise it applies the current color to every highlight here.
        </p>
        <div className="space-y-4 min-w-0">
          <div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs text-muted-foreground">Text</Label>
              <Button
                type="button"
                variant={highlightStyle === "outline" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs shrink-0"
                onClick={() =>
                  onHighlightStyleChange(highlightStyle === "outline" ? "text" : "outline")
                }
                title="Black outline on all highlighted words (toggle on/off)"
              >
                Outline
              </Button>
            </div>
            <Textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onBlur={onSaveSelection}
              placeholder={target === "headline" ? "Headline..." : "Body text..."}
              className="min-h-[80px] mt-1 resize-none text-sm"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Colors</Label>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={onAuto} title="Highlight key words automatically">
                Auto
              </Button>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onSaveSelection(); }}
                onClick={() => onRemoveFromSelection(true)}
                className="rounded px-2 py-1 text-xs font-medium border border-transparent hover:border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                title="Remove highlight from selection"
              >
                No color
              </button>
              {Object.keys(HIGHLIGHT_COLORS).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); onSaveSelection(); }}
                  onClick={() => { onHighlightColorChange(HIGHLIGHT_COLORS[preset] ?? "#facc15"); onApplyToSelection(preset, true); }}
                  className={`rounded px-2 py-1 text-xs font-medium capitalize hover:bg-muted border ${highlightColor === (HIGHLIGHT_COLORS[preset] ?? "") ? "border-foreground/50 bg-muted" : "border-transparent hover:border-border"}`}
                  style={{ color: HIGHLIGHT_COLORS[preset] as string }}
                  title={`Apply ${preset} to selection`}
                >
                  {preset}
                </button>
              ))}
              <input
                type="color"
                className="h-8 w-9 cursor-pointer rounded border border-input bg-background"
                value={highlightColor}
                onChange={(e) => onHighlightColorChange(e.target.value)}
                onMouseDown={() => onSaveSelection()}
                onClick={() => {
                  if (textareaRef.current && textareaRef.current.selectionStart !== textareaRef.current.selectionEnd) {
                    onApplyToSelection(highlightColor, true);
                  }
                }}
                title="Custom color"
                aria-label="Custom highlight"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/50">
            {highlights.length > 0 && (
              <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={onClearAll} title="Clear all highlights">
                Clear all highlights
              </Button>
            )}
            <div className="flex flex-wrap items-center gap-1.5">
              {(["text", "background"] as const).map((style) => (
                <Button
                  key={style}
                  type="button"
                  variant={highlightStyle === style ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => onHighlightStyleChange(style)}
                  title={
                    style === "text"
                      ? "Highlight style: text color only"
                      : "Highlight style: colored background"
                  }
                >
                  {style === "text" ? "Text" : "Bg"}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg max-h-[90vh] overflow-y-auto"
        showCloseButton
      >
        <DialogHeader className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-base">{title}</DialogTitle>
            {(highlights.length > 0 || (totalSlides > 1 && lastHighlightAction === "auto")) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs shrink-0"
                onClick={onApplyToAll}
                disabled={applyingAutoHighlights}
                title={
                  lastHighlightAction === "auto" && totalSlides > 1
                    ? target === "headline"
                      ? "Run Auto on headlines for every slide"
                      : "Run Auto on body for every slide"
                    : "Apply current color to all highlights in this field"
                }
              >
                {applyingAutoHighlights ? (
                  <Loader2Icon className="size-3.5 animate-spin" />
                ) : (
                  <CopyIcon className="size-3.5" />
                )}{" "}
                Apply to all highlights
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Select text in the box below, then pick a color (or Auto to highlight key words). Use No color to remove a highlight. You can see the result in the live preview above. If you just used Auto, “Apply to all highlights” runs Auto on every slide; otherwise it applies the current color to every highlight here.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs text-muted-foreground">Text</Label>
              <Button
                type="button"
                variant={highlightStyle === "outline" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs shrink-0"
                onClick={() =>
                  onHighlightStyleChange(highlightStyle === "outline" ? "text" : "outline")
                }
                title="Black outline on all highlighted words (toggle on/off)"
              >
                Outline
              </Button>
            </div>
            <Textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onBlur={onSaveSelection}
              placeholder={target === "headline" ? "Headline..." : "Body text..."}
              className="min-h-[80px] mt-1 resize-none text-sm"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Colors</Label>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={onAuto}
                title="Highlight key words automatically"
              >
                Auto
              </Button>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSaveSelection();
                }}
                onClick={() => onRemoveFromSelection(true)}
                className="rounded px-2 py-1 text-xs font-medium border border-transparent hover:border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                title="Remove highlight from selection"
              >
                No color
              </button>
              {Object.keys(HIGHLIGHT_COLORS).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSaveSelection();
                  }}
                  onClick={() => {
                    onHighlightColorChange(HIGHLIGHT_COLORS[preset] ?? "#facc15");
                    onApplyToSelection(preset, true);
                  }}
                  className={`rounded px-2 py-1 text-xs font-medium capitalize hover:bg-muted border ${
                    highlightColor === (HIGHLIGHT_COLORS[preset] ?? "")
                      ? "border-foreground/50 bg-muted"
                      : "border-transparent hover:border-border"
                  }`}
                  style={{ color: HIGHLIGHT_COLORS[preset] as string }}
                  title={`Apply ${preset} to selection`}
                >
                  {preset}
                </button>
              ))}
              <input
                type="color"
                className="h-8 w-9 cursor-pointer rounded border border-input bg-background"
                value={highlightColor}
                onChange={(e) => onHighlightColorChange(e.target.value)}
                onMouseDown={() => onSaveSelection()}
                onClick={() => {
                  if (textareaRef.current && textareaRef.current.selectionStart !== textareaRef.current.selectionEnd) {
                    onApplyToSelection(highlightColor, true);
                  }
                }}
                title="Custom color"
                aria-label="Custom highlight"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/50">
            {highlights.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={onClearAll}
                title="Clear all highlights"
              >
                Clear all highlights
              </Button>
            )}
            <div className="flex flex-wrap items-center gap-1.5">
              {(["text", "background"] as const).map((style) => (
                <Button
                  key={style}
                  type="button"
                  variant={highlightStyle === style ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => onHighlightStyleChange(style)}
                  title={
                    style === "text"
                      ? "Highlight style: text color only"
                      : "Highlight style: colored background"
                  }
                >
                  {style === "text" ? "Text" : "Bg"}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
