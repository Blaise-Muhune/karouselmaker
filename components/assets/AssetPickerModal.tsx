"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { ImageIcon, Loader2Icon } from "lucide-react";

type LibraryScope = "all" | "project";

type AssetPickerModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (asset: Asset, url: string) => void;
  /** When set: filter “this project” vs all; uploads/Drive attach to this project. */
  projectId?: string | null;
};

export function AssetPickerModal({
  open,
  onOpenChange,
  onPick,
  projectId,
}: AssetPickerModalProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [libraryScope, setLibraryScope] = useState<LibraryScope>("all");

  const contextProjectId = projectId?.trim() || undefined;

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
    if (!open) return;
    void loadLibrary();
  }, [open, loadLibrary]);

  const displayAssets = useMemo(() => {
    if (!contextProjectId || libraryScope === "all") return assets;
    return assets.filter((a) => a.project_id === contextProjectId);
  }, [assets, contextProjectId, libraryScope]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col overflow-hidden" showCloseButton>
        <DialogHeader>
          <DialogTitle>Choose background image</DialogTitle>
          <DialogDescription>
            Pick from your library (newest first). Upload multiple files or import from Google Drive without leaving this
            dialog.
          </DialogDescription>
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
            <p className="text-muted-foreground text-xs">Newest uploads first.</p>
          )}
          <LibraryImageImportBar attachProjectId={contextProjectId ?? null} onRefresh={loadLibrary} size="sm" />
        </div>

        {loading ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : displayAssets.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            {contextProjectId && libraryScope === "project"
              ? "No images for this project yet. Switch to “All images” or add files above."
              : "No images yet. Use Upload or Drive above."}
          </p>
        ) : (
          <ul className="grid max-h-[min(52vh,480px)] gap-2 overflow-y-auto sm:grid-cols-4 md:grid-cols-5">
            {displayAssets.map((asset) => (
              <li key={asset.id}>
                <button
                  type="button"
                  onClick={() => {
                    const url = urls[asset.id];
                    if (url) {
                      onPick(asset, url);
                      onOpenChange(false);
                    }
                  }}
                  className="border-border/50 hover:border-primary/30 flex aspect-square w-full overflow-hidden rounded-lg border bg-muted/10 transition-colors hover:bg-muted/20 focus:outline-none focus:ring-2 focus:ring-primary/50"
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
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
