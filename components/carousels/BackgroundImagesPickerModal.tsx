"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { listAssetsWithUrls } from "@/app/actions/assets/listAssetsWithUrls";
import type { Asset } from "@/lib/server/db/types";
import { ImageIcon, Loader2Icon, CheckIcon } from "lucide-react";

const MAX_IMAGES = 4;

type BackgroundImagesPickerModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  onConfirm: (ids: string[]) => void;
  projectId?: string | null;
};

export function BackgroundImagesPickerModal({
  open,
  onOpenChange,
  selectedIds,
  onConfirm,
  projectId,
}: BackgroundImagesPickerModalProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(new Set(selectedIds));

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => setSelection(new Set(selectedIds)));
  }, [open, selectedIds]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    listAssetsWithUrls(projectId ?? undefined)
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setAssets(result.assets);
          setUrls(result.urls);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    const id = setTimeout(() => setLoading(true), 0);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [open, projectId]);

  const toggle = (id: string) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selection));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col" showCloseButton>
        <DialogHeader>
          <DialogTitle>Background images for slides</DialogTitle>
          <DialogDescription>
            Select 1–4 images. They will be applied to slides in order (round-robin). First slide can use 1 or 2 images (full + circle).
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : assets.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No images in library. Upload images on the Assets page first.
          </p>
        ) : (
          <ul className="grid flex-1 gap-2 overflow-y-auto sm:grid-cols-4 md:grid-cols-5">
            {assets.map((asset) => {
              const isSelected = selection.has(asset.id);
              return (
                <li key={asset.id}>
                  <button
                    type="button"
                    onClick={() => toggle(asset.id)}
                    className={`relative flex aspect-square w-full overflow-hidden rounded-xl border-2 transition-all focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border bg-muted/30 hover:border-primary/50"
                    }`}
                  >
                    {urls[asset.id] ? (
                      <img
                        src={urls[asset.id]}
                        alt={asset.file_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <ImageIcon className="size-8" />
                      </span>
                    )}
                    {isSelected && (
                      <span className="absolute right-2 top-2 rounded-full bg-primary p-1 text-primary-foreground">
                        <CheckIcon className="size-4" />
                      </span>
                    )}
                    {!isSelected && selection.size >= MAX_IMAGES && (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs text-white">
                        Max 4
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Use {selection.size} image{selection.size !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
