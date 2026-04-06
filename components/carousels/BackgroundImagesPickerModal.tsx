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

const DEFAULT_MAX_IMAGES = 30;

type BackgroundImagesPickerModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  onConfirm: (ids: string[]) => void;
  /** Max selectable images (default 30 for slide backgrounds). */
  maxSelection?: number;
  dialogTitle?: string;
  dialogDescription?: string;
  /** When set, only list assets for this project (`null` = library rows with no project). When omitted, list full library. */
  listFilterProjectId?: string | null;
  /** When true, Confirm works with 0 images (clears selection). */
  allowEmptyConfirm?: boolean;
};

export function BackgroundImagesPickerModal({
  open,
  onOpenChange,
  selectedIds,
  onConfirm,
  maxSelection = DEFAULT_MAX_IMAGES,
  dialogTitle = "Background images for carousel frames",
  dialogDescription = "Select 1–30 images. They will be applied to frames in order (round-robin). First frame can use 1 or 2 images (full + circle).",
  listFilterProjectId,
  allowEmptyConfirm = false,
}: BackgroundImagesPickerModalProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(() => new Set(selectedIds.slice(0, maxSelection)));

  // Keep selection in sync with selectedIds (e.g. after Import folder / Pick images from Drive) so those images show as selected when the modal opens.
  useEffect(() => {
    const ids = selectedIds.slice(0, maxSelection);
    setSelection(new Set(ids));
  }, [open, selectedIds, maxSelection]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    listAssetsWithUrls(listFilterProjectId !== undefined ? { projectId: listFilterProjectId } : undefined)
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
    return () => {
      cancelled = true;
    };
  }, [open, listFilterProjectId]);

  const toggle = (id: string) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < maxSelection) next.add(id);
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
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
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
                    className={`relative flex aspect-square w-full overflow-hidden rounded-xl border-2 transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                      isSelected
                        ? "border-primary border-[3px] bg-primary/20 ring-2 ring-primary ring-offset-2"
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
                      <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
                        <CheckIcon className="size-4" strokeWidth={2.5} />
                      </span>
                    )}
                    {!isSelected && selection.size >= maxSelection && (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs text-white">
                        Max {maxSelection}
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
          <Button onClick={handleConfirm} disabled={!allowEmptyConfirm && selection.size === 0}>
            {selection.size === 0
              ? allowEmptyConfirm
                ? "Clear"
                : "Select at least one"
              : `Use ${selection.size} image${selection.size !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
