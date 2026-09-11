"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateCaption } from "@/app/actions/carousels/updateCaption";
import { combineCaptionWithHashtags } from "@/components/editor/EditorCaptionSection";
import { Loader2Icon } from "lucide-react";

type CaptionEditModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  carouselId: string;
  captionVariants: { title?: string; medium?: string; long?: string };
  hashtags: string[];
  editorPath: string;
  onSaved?: () => void;
  /** LinkedIn-specific labels and hints for document carousel posts. */
  carouselFor?: "instagram" | "linkedin";
};

/** Split trailing hashtag tokens from a combined caption field. */
function splitCaptionAndHashtags(combined: string): { long: string; hashtags: string[] } {
  const lines = combined.replace(/\r\n/g, "\n").trimEnd().split("\n");
  if (lines.length === 0) return { long: "", hashtags: [] };

  const isHashtagOnlyLine = (line: string) => {
    const t = line.trim();
    if (!t) return false;
    const parts = t.split(/\s+/).filter(Boolean);
    return parts.length > 0 && parts.every((p) => /^#?[\w\u00C0-\u024F]+$/i.test(p.replace(/^#/, "")) && p.replace(/^#/, "").length > 0);
  };

  let cut = lines.length;
  while (cut > 0 && !lines[cut - 1]!.trim()) cut--;
  while (cut > 0 && isHashtagOnlyLine(lines[cut - 1]!)) cut--;
  // Drop blank line(s) between body and hashtags
  while (cut > 0 && !lines[cut - 1]!.trim()) cut--;

  const bodyLines = lines.slice(0, cut);
  const tagLines = lines.slice(cut);
  const hashtags = tagLines
    .join(" ")
    .split(/[\s,#]+/)
    .map((h) => h.replace(/^#/, "").trim())
    .filter(Boolean);
  return { long: bodyLines.join("\n").trim(), hashtags };
}

export function CaptionEditModal({
  open,
  onOpenChange,
  carouselId,
  captionVariants,
  hashtags,
  editorPath,
  onSaved,
  carouselFor,
}: CaptionEditModalProps) {
  const isLinkedIn = carouselFor === "linkedin";
  const [title, setTitle] = useState(captionVariants.title ?? "");
  const [caption, setCaption] = useState(() =>
    combineCaptionWithHashtags(captionVariants.long ?? "", hashtags)
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const { long, hashtags: hashtagList } = splitCaptionAndHashtags(caption);
    const result = await updateCaption(
      {
        carousel_id: carouselId,
        caption_variants: {
          title: title || undefined,
          long: long || undefined,
          // Clear medium so the simplified UI stays the source of truth.
          medium: undefined,
        },
        hashtags: hashtagList,
      },
      editorPath
    );
    setSaving(false);
    if (result.ok) {
      onSaved?.();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>Edit caption</DialogTitle>
          <DialogDescription>
            {isLinkedIn
              ? "First line for the feed preview, then your caption. Put hashtags at the end of the caption (they copy with it)."
              : "Title for SEO, then your caption. Put hashtags at the end of the caption so Copy grabs everything."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div>
            <Label htmlFor="title">{isLinkedIn ? "First line (feed preview)" : "Title (SEO)"}</Label>
            <Textarea
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                isLinkedIn
                  ? "Strong hook—this is what shows before “see more”"
                  : "Short post title, optimized for search"
              }
              className="mt-1 min-h-[60px]"
            />
          </div>
          <div>
            <Label htmlFor="caption">Caption</Label>
            <Textarea
              id="caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={
                isLinkedIn
                  ? "Full caption…\n\n#leadership #saas #b2b"
                  : "Your post caption…\n\n#tag1 #tag2 #tag3"
              }
              className="mt-1 min-h-[160px]"
            />
            <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug">
              End with hashtags on their own line(s). Copy on the carousel page includes them automatically.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2Icon className="size-4 animate-spin" /> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
