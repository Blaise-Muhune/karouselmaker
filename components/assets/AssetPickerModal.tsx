"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { listAssetsWithUrls } from "@/app/actions/assets/listAssetsWithUrls";
import { importSingleFileFromGoogleDrive } from "@/app/actions/assets/importFromGoogleDrive";
import { GoogleDriveFilePicker } from "@/components/drive/GoogleDriveFilePicker";
import type { Asset } from "@/lib/server/db/types";
import { ImageIcon, Loader2Icon } from "lucide-react";

type AssetPickerModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (asset: Asset, url: string) => void;
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
  const [driveImporting, setDriveImporting] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);

  const refetchAssets = useCallback(() => {
    listAssetsWithUrls(projectId ?? undefined).then((result) => {
      if (result.ok) {
        setAssets(result.assets);
        setUrls(result.urls);
      }
    });
  }, [projectId]);

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

  const handleDriveFilePicked = useCallback(
    async (fileId: string, accessToken: string) => {
      setDriveError(null);
      setDriveImporting(true);
      const result = await importSingleFileFromGoogleDrive(fileId, accessToken, projectId ?? undefined);
      setDriveImporting(false);
      if (result.ok) {
        refetchAssets();
      } else {
        setDriveError(result.error);
      }
    },
    [projectId, refetchAssets]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" showCloseButton>
        <DialogHeader>
          <DialogTitle>Choose background image</DialogTitle>
          <DialogDescription>
            Select an image from your library. Upload new images from the Asset library page.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2 border-b border-border/50 pb-3">
          <GoogleDriveFilePicker
            onFilePicked={handleDriveFilePicked}
            onError={setDriveError}
            variant="outline"
            size="sm"
            disabled={driveImporting}
          >
            {driveImporting ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <>Pick one from Drive</>
            )}
          </GoogleDriveFilePicker>
          {driveError && (
            <p className="text-destructive text-xs w-full">{driveError}</p>
          )}
        </div>
        {loading ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : assets.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No images in library. Upload images on the Asset library page first.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-4 md:grid-cols-5">
            {assets.map((asset) => (
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
