"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listAssetsWithUrls } from "@/app/actions/assets/listAssetsWithUrls";
import { LibraryImageImportBar } from "@/components/assets/LibraryImageImportBar";
import type { Asset } from "@/lib/server/db/types";
import { ImageIcon, Loader2Icon, CheckIcon } from "lucide-react";

const DEFAULT_MAX_IMAGES = 30;

type LibraryScope = "all" | "project";

type BackgroundImagesPickerModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  onConfirm: (ids: string[]) => void;
  /** Max selectable images (default 30 for slide backgrounds). */
  maxSelection?: number;
  dialogTitle?: string;
  dialogDescription?: string;
  /**
   * When set, user can filter between the full library (newest first) and assets linked to this project.
   * New uploads and Drive imports from this modal are attached to this project.
   */
  contextProjectId?: string;
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
  contextProjectId,
  allowEmptyConfirm = false,
}: BackgroundImagesPickerModalProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [libraryScope, setLibraryScope] = useState<LibraryScope>("all");
  const [selection, setSelection] = useState<Set<string>>(() => new Set(selectedIds.slice(0, maxSelection)));

  const loadLibrary = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listAssetsWithUrls();
      if (result.ok) {
        setAssets(result.assets);
        setUrls(result.urls);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ids = selectedIds.slice(0, maxSelection);
    setSelection(new Set(ids));
  }, [open, selectedIds, maxSelection]);

  useEffect(() => {
    if (!open) return;
    void loadLibrary();
  }, [open, loadLibrary]);

  const displayAssets = useMemo(() => {
    if (!contextProjectId || libraryScope === "all") return assets;
    return assets.filter((a) => a.project_id === contextProjectId);
  }, [assets, contextProjectId, libraryScope]);

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
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col" showCloseButton>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 border-b border-border/50 pb-3">
          {contextProjectId ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground shrink-0 text-xs">Library</span>
              <Select value={libraryScope} onValueChange={(v) => setLibraryScope(v as LibraryScope)}>
                <SelectTrigger className="h-8 w-[min(100%,220px)] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All images (newest first)</SelectItem>
                  <SelectItem value="project">This project only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">Newest uploads first. Add images with Upload or Google Drive below.</p>
          )}
          <LibraryImageImportBar
            attachProjectId={contextProjectId ?? null}
            onRefresh={loadLibrary}
            size="sm"
          />
        </div>

        {loading ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : displayAssets.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            {contextProjectId && libraryScope === "project"
              ? "No images linked to this project yet. Switch to “All images” or upload above—they’ll be saved to this project."
              : "No images in your library yet. Use Upload or Drive above."}
          </p>
        ) : (
          <ul className="grid max-h-[min(52vh,480px)] flex-1 gap-2 overflow-y-auto sm:grid-cols-4 md:grid-cols-5">
            {displayAssets.map((asset) => {
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
