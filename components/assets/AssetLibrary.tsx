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
}: AssetLibraryProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const assets = initialAssets;
  const urls = initialUrls;
  const [uploading, setUploading] = useState(false);
  const [projectFilter, setProjectFilter] = useState<string>(projectIdFilter ?? "all");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.set("file", file);
    if (projectFilter !== "all") formData.set("project_id", projectFilter);
    const result = await uploadAsset(formData, "/assets");
    setUploading(false);
    e.target.value = "";
    if (result.ok) {
      startTransition(() => router.refresh());
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
    <div className="space-y-4">
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
        <label className="cursor-pointer">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
            disabled={uploading}
          />
          <Button type="button" variant="outline" size="sm" asChild>
            <span>
              {uploading ? (
                <Loader2Icon className="mr-2 size-4 animate-spin" />
              ) : (
                <UploadIcon className="mr-2 size-4" />
              )}
              Upload image
            </span>
          </Button>
        </label>
      </div>

      {filteredAssets.length === 0 ? (
        <div className="text-muted-foreground flex min-h-[200px] items-center justify-center rounded-lg border border-dashed p-8 text-center text-sm">
          No images yet. Upload an image to use as slide backgrounds.
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filteredAssets.map((asset) => (
            <li key={asset.id}>
              <button
                type="button"
                onClick={() => setSelectedAsset(asset)}
                className="border-border hover:border-primary/50 flex aspect-square w-full overflow-hidden rounded-lg border bg-muted/30 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
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
