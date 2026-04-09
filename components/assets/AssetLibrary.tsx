"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
import { setSlideBackground } from "@/app/actions/slides/setSlideBackground";
import { LibraryImageImportBar } from "@/components/assets/LibraryImageImportBar";
import { UpgradeBanner } from "@/components/subscription/UpgradeBanner";
import { PLAN_LIMITS } from "@/lib/constants";
import type { Asset } from "@/lib/server/db/types";
import { ImageIcon } from "lucide-react";

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
          {filteredAssets.map((asset) => (
            <li key={asset.id}>
              <button
                type="button"
                onClick={() => {
                  setApplyError(null);
                  setSelectedAsset(asset);
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
    </div>
  );
}
