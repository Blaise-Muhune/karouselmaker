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
import { Loader2Icon } from "lucide-react";

type CaptionEditModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  carouselId: string;
  captionVariants: { title?: string; medium?: string; long?: string };
  hashtags: string[];
  editorPath: string;
  onSaved?: () => void;
};

export function CaptionEditModal({
  open,
  onOpenChange,
  carouselId,
  captionVariants,
  hashtags,
  editorPath,
  onSaved,
}: CaptionEditModalProps) {
  const [title, setTitle] = useState(captionVariants.title ?? "");
  const [medium, setMedium] = useState(captionVariants.medium ?? "");
  const [long, setLong] = useState(captionVariants.long ?? "");
  const [hashtagsStr, setHashtagsStr] = useState(() => hashtags.join(" "));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const hashtagList = hashtagsStr
      .split(/[\s,#]+/)
      .map((h) => h.replace(/^#/, "").trim())
      .filter(Boolean);
    const result = await updateCaption(
      {
        carousel_id: carouselId,
        caption_variants: { title: title || undefined, medium: medium || undefined, long: long || undefined },
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
          <DialogTitle>Edit caption & hashtags</DialogTitle>
          <DialogDescription>
            Title (SEO), medium caption (engagement), long caption, and hashtags. Hashtags as space- or comma-separated.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div>
            <Label htmlFor="title">Title (SEO)</Label>
            <Textarea
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short post title, optimized for search"
              className="mt-1 min-h-[60px]"
            />
          </div>
          <div>
            <Label htmlFor="medium">Medium caption (engagement)</Label>
            <Textarea
              id="medium"
              value={medium}
              onChange={(e) => setMedium(e.target.value)}
              placeholder="Caption with more context, questions, or explanation"
              className="mt-1 min-h-[80px]"
            />
          </div>
          <div>
            <Label htmlFor="long">Long caption</Label>
            <Textarea
              id="long"
              value={long}
              onChange={(e) => setLong(e.target.value)}
              placeholder="Longer caption with full context"
              className="mt-1 min-h-[120px]"
            />
          </div>
          <div>
            <Label htmlFor="hashtags">Hashtags</Label>
            <Textarea
              id="hashtags"
              value={hashtagsStr}
              onChange={(e) => setHashtagsStr(e.target.value)}
              placeholder="#tag1 #tag2 or tag1, tag2"
              className="mt-1 min-h-[60px]"
            />
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
