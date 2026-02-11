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
import { uploadAsset } from "@/app/actions/assets/uploadAsset";
import { setSlideBackground } from "@/app/actions/slides/setSlideBackground";
import { UpgradeBanner } from "@/components/subscription/UpgradeBanner";
import { PLAN_LIMITS } from "@/lib/constants";
import type { Asset } from "@/lib/server/db/types";
import { ImageIcon, Loader2Icon, UploadIcon } from "lucide-react";

type AssetLibraryProps = {
  assets: Asset[];
  imageUrls: Record<string, string>;
  projects: { id: string; name: string }[];
  projectIdFilter: string | null;
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
  projectIdFilter,
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
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<string>(projectIdFilter ?? "all");

  const atLimit = assetLimit > 0 && assetCount >= assetLimit;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (atLimit) return;
    setUploading(true);
    setUploadError(null);
    const formData = new FormData();
    formData.set("file", file);
    if (projectFilter !== "all") formData.set("project_id", projectFilter);
    const result = await uploadAsset(formData, "/assets");
    setUploading(false);
    e.target.value = "";
    if (result.ok) {
      startTransition(() => router.refresh());
    } else {
      setUploadError(result.error ?? "Upload failed");
    }
  };

  const handleUseAsBackground = async () => {
    if (!selectedAsset || !slideId) return;
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
    }
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
          message={`You've reached the ${assetLimit} image limit on the free plan. Upgrade to Pro for ${PLAN_LIMITS.pro.assets} images.`}
          variant="inline"
        />
      )}
      {uploadError && !isPro && (uploadError.toLowerCase().includes("limit") || uploadError.toLowerCase().includes("upgrade")) && (
        <UpgradeBanner
          message={uploadError}
          variant="inline"
        />
      )}
      {uploadError && (!uploadError.toLowerCase().includes("limit") && !uploadError.toLowerCase().includes("upgrade")) && (
        <p className="text-destructive text-sm rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">{uploadError}</p>
      )}
      <section>
        <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
          Library
        </p>
        <div className="flex flex-wrap items-center gap-2">
        <Select
          value={projectFilter}
          onValueChange={setProjectFilter}
          disabled={isPending}
        >
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
        <span className="text-muted-foreground text-xs">
          {assetCount}/{assetLimit} images
        </span>
        <label className={atLimit ? "cursor-not-allowed opacity-60" : "cursor-pointer"}>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
            disabled={uploading || atLimit}
          />
          <Button type="button" variant="outline" size="sm" disabled={uploading || atLimit} asChild>
            <span>
              {uploading ? (
                <Loader2Icon className="mr-2 size-4 animate-spin" />
              ) : (
                <UploadIcon className="mr-2 size-4" />
              )}
              {atLimit ? "Upload (limit reached)" : "Upload image"}
            </span>
          </Button>
        </label>
      </div>

      {filteredAssets.length === 0 ? (
        <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/20 p-8 text-center">
          <p className="text-muted-foreground text-sm mb-2">
            No images yet. Upload your first image to use as slide backgrounds.
          </p>
          <p className="text-muted-foreground text-xs mb-4 max-w-sm">
            Pro tip: Use high-res images (1080×1080 or larger). Landscapes, textures, and solid colors work great.
          </p>
          <p className="text-xs text-muted-foreground/80">
            Drag & drop or click Upload above ↑
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filteredAssets.map((asset) => (
            <li key={asset.id}>
              <button
                type="button"
                onClick={() => setSelectedAsset(asset)}
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

      <Dialog open={!!selectedAsset} onOpenChange={(open) => !open && setSelectedAsset(null)}>
        <DialogContent className="max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>{selectedAsset?.file_name ?? "Image"}</DialogTitle>
            <DialogDescription>
              {pickerMode && slideId
                ? "Use this image as the slide background."
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
