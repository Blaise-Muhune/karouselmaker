"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { deleteAssetsAction } from "@/app/actions/assets/deleteAsset";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { setSlideBackground } from "@/app/actions/slides/setSlideBackground";
import { LibraryImageImportBar } from "@/components/assets/LibraryImageImportBar";
import { UpgradeBanner } from "@/components/subscription/UpgradeBanner";
import { PLAN_LIMITS } from "@/lib/constants";
import type { Asset } from "@/lib/server/db/types";
import { ImageIcon, Trash2Icon } from "lucide-react";

type AssetLibraryProps = {
  assets: Asset[];
  imageUrls: Record<string, string>;
  projects: { id: string; name: string }[];
  /** Initial row in the project filter: all assets, global-only, or a project id. */
  initialProjectFilter?: string;
  pickerMode?: boolean;
  slideId?: string;
  returnTo?: string;
  onPick?: (asset: Asset, url: string) => void;
  assetCount?: number;
  assetLimit?: number;
  isPro?: boolean;
};

export function AssetLibrary({
  assets: initialAssets,
  imageUrls: initialUrls,
  projects,
  initialProjectFilter = "all",
  pickerMode,
  slideId,
  returnTo,
  onPick,
  assetCount = 0,
  assetLimit = 100,
  isPro = true,
}: AssetLibraryProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const assets = initialAssets;
  const urls = initialUrls;
  const [applyError, setApplyError] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<string>(initialProjectFilter);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const allowBulkSelect = !(pickerMode && slideId);

  const atLimit = assetLimit > 0 && assetCount >= assetLimit;

  const attachProjectIdForImport =
    projectFilter !== "all" && projectFilter !== "global" ? projectFilter : null;

  const handleUseAsBackground = async () => {
    if (!selectedAsset || !slideId) return;
    setApplyError(null);
    const url = urls[selectedAsset.id] ?? "";
    if (onPick) {
      onPick(selectedAsset, url);
      setSelectedAsset(null);
      return;
    }
    const result = await setSlideBackground(
      slideId,
      {
        mode: "image",
        asset_id: selectedAsset.id,
        storage_path: selectedAsset.storage_path,
        fit: "cover",
        overlay: { gradient: true, darken: 0.35, blur: 0 },
      },
      returnTo ?? "/assets"
    );
    if (result.ok) {
      setSelectedAsset(null);
      if (returnTo) router.push(returnTo);
      else router.refresh();
      return;
    }
    setApplyError(result.error ?? "Couldn't apply this image as background.");
  };

  const filteredAssets =
    projectFilter === "all"
      ? assets
      : projectFilter === "global"
        ? assets.filter((a) => a.project_id == null)
        : assets.filter((a) => a.project_id === projectFilter);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [projectFilter]);

  const selectedInView = filteredAssets.filter((a) => selectedIds.has(a.id));
  const selectedCount = selectedInView.length;
  const allFilteredSelected =
    filteredAssets.length > 0 && filteredAssets.every((a) => selectedIds.has(a.id));

  const toggleAssetSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds(new Set(filteredAssets.map((a) => a.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const runBulkDelete = async () => {
    if (selectedCount === 0) return;
    setDeleteError(null);
    setIsDeleting(true);
    const result = await deleteAssetsAction(
      selectedInView.map((a) => a.id),
      "/assets"
    );
    setIsDeleting(false);
    if (result.ok) {
      const removedIds = new Set(selectedInView.map((a) => a.id));
      setDeleteConfirmOpen(false);
      clearSelection();
      setSelectedAsset((cur) => (cur && removedIds.has(cur.id) ? null : cur));
      startTransition(() => router.refresh());
      return;
    }
    setDeleteError(result.error);
  };

  return (
    <div className="space-y-6">
      {atLimit && !isPro && (
        <UpgradeBanner
          message={`You've reached the ${assetLimit} image limit on the free plan. Paid plans include up to ${PLAN_LIMITS.studio.assets} library images (Studio).`}
          variant="inline"
        />
      )}
      <section>
        <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
          Library
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={projectFilter} onValueChange={setProjectFilter} disabled={isPending}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All assets</SelectItem>
                <SelectItem value="global">Global (no project)</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-muted-foreground text-xs tabular-nums">
              {assetCount}/{assetLimit} images
            </span>
          </div>
          <LibraryImageImportBar
            attachProjectId={attachProjectIdForImport}
            onRefresh={() => startTransition(() => router.refresh())}
            atLimit={atLimit}
            revalidatePathname="/assets"
            disabled={isPending}
            className="min-w-0 flex-1"
          />
        </div>
        {allowBulkSelect && filteredAssets.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              disabled={isPending || isDeleting || allFilteredSelected}
              onClick={selectAllFiltered}
            >
              Select all
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              disabled={isPending || isDeleting || selectedCount === 0}
              onClick={clearSelection}
            >
              Clear selection
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-8 text-xs"
              disabled={isPending || isDeleting || selectedCount === 0}
              onClick={() => {
                setDeleteError(null);
                setDeleteConfirmOpen(true);
              }}
            >
              <Trash2Icon className="mr-1.5 size-3.5" />
              Delete{selectedCount > 0 ? ` (${selectedCount})` : ""}
            </Button>
            {selectedCount > 0 && (
              <span className="text-muted-foreground text-xs tabular-nums">
                {selectedCount} selected
              </span>
            )}
          </div>
        )}

      {filteredAssets.length === 0 ? (
        <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/20 p-8 text-center">
          <p className="text-muted-foreground text-sm mb-2">
            No images yet. Upload your first image to use as carousel frame backgrounds.
          </p>
          <p className="text-muted-foreground text-xs mb-4 max-w-sm">
            Pro tip: Use high-res images (1080×1080 or larger). Landscapes, textures, and solid colors work great.
          </p>
          <p className="text-xs text-muted-foreground/80">Use Upload or Google Drive above to add images.</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filteredAssets.map((asset) => {
            const checked = selectedIds.has(asset.id);
            return (
              <li key={asset.id} className="relative">
                {allowBulkSelect && (
                  <label className="absolute left-2 top-2 z-10 flex cursor-pointer items-center rounded-md border border-border/80 bg-background/90 p-1 shadow-sm backdrop-blur-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAssetSelected(asset.id)}
                      disabled={isPending || isDeleting}
                      className="size-4 rounded border-input accent-primary"
                      aria-label={`Select ${asset.file_name}`}
                    />
                  </label>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setApplyError(null);
                    setSelectedAsset(asset);
                  }}
                  className={`border-border/50 hover:border-primary/30 flex aspect-square w-full overflow-hidden rounded-lg border bg-muted/10 transition-colors hover:bg-muted/20 focus:outline-none focus:ring-2 focus:ring-primary/50 ${checked ? "ring-2 ring-primary/40" : ""}`}
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
            );
          })}
        </ul>
      )}
      </section>

      <Dialog
        open={!!selectedAsset}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedAsset(null);
            setApplyError(null);
          }
        }}
      >
        <DialogContent className="max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>{selectedAsset?.file_name ?? "Image"}</DialogTitle>
            <DialogDescription>
              {pickerMode && slideId
                ? "Use this image as the frame background."
                : "Preview."}
            </DialogDescription>
          </DialogHeader>
          {selectedAsset && urls[selectedAsset.id] && (
            <div className="aspect-square w-full overflow-hidden rounded-lg bg-muted">
              <img
                src={urls[selectedAsset.id]}
                alt={selectedAsset.file_name}
                className="h-full w-full object-contain"
              />
            </div>
          )}
          {pickerMode && slideId && selectedAsset && (
            <Button onClick={handleUseAsBackground} className="w-full">
              Use as background
            </Button>
          )}
          {applyError && (
            <p className="text-destructive text-xs rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
              {applyError}
            </p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Delete {selectedCount} image{selectedCount !== 1 ? "s" : ""}?</DialogTitle>
            <DialogDescription>
              This removes them from your library and from storage. Slides that used these images may show a missing
              background until you pick a new one. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p className="text-destructive text-xs rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
              {deleteError}
            </p>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={runBulkDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
