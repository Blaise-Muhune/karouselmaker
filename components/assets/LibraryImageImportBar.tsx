"use client";

import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { uploadAsset } from "@/app/actions/assets/uploadAsset";
import { importFilesFromGoogleDrive } from "@/app/actions/assets/importFromGoogleDrive";
import { GoogleDriveFolderPicker } from "@/components/drive/GoogleDriveFolderPicker";
import { GoogleDriveMultiFilePicker } from "@/components/drive/GoogleDriveMultiFilePicker";
import { ImageIcon, Loader2Icon, UploadIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type LibraryImageImportBarProps = {
  /** New uploads and Drive imports are tagged with this project (omit or null = global library). */
  attachProjectId?: string | null;
  /** Called after a successful add so the parent can refetch the library. Passes new asset ids when available. */
  onRefresh: (newAssetIds?: string[]) => void | Promise<void>;
  /** Notifies parent while upload/Drive import is in progress (so Confirm/Generate can wait). */
  onBusyChange?: (busy: boolean) => void;
  disabled?: boolean;
  atLimit?: boolean;
  className?: string;
  /** When set, also revalidate this server path (e.g. `/assets`). */
  revalidatePathname?: string;
  size?: "sm" | "default";
};

/**
 * Upload from device (multi-select) + Google Drive folder / multi-file import.
 * Reusable in asset modals and the asset library page.
 */
export function LibraryImageImportBar({
  attachProjectId,
  onRefresh,
  onBusyChange,
  disabled = false,
  atLimit = false,
  className,
  revalidatePathname,
  size = "sm",
}: LibraryImageImportBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [driveBusy, setDriveBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const busy = disabled || atLimit || uploading || driveBusy;
  const btnSize = size === "sm" ? "sm" : "default";
  const h = size === "sm" ? "h-8 text-xs" : "";

  useEffect(() => {
    onBusyChange?.(uploading || driveBusy);
  }, [uploading, driveBusy, onBusyChange]);

  async function handleFilesSelected(files: FileList | null) {
    if (!files?.length || atLimit) return;
    setMessage(null);
    setUploading(true);
    try {
      // One server action per file — avoids the ~25MB body limit when picking several phone photos.
      const list = Array.from(files).filter(Boolean).slice(0, 30);
      const assetIds: string[] = [];
      const errors: string[] = [];
      for (let i = 0; i < list.length; i++) {
        const file = list[i]!;
        const fd = new FormData();
        fd.set("file", file);
        if (attachProjectId?.trim()) fd.set("project_id", attachProjectId.trim());
        const isLast = i === list.length - 1;
        const result = await uploadAsset(fd, isLast ? revalidatePathname : undefined);
        if (result.ok) assetIds.push(result.assetId);
        else errors.push(`${file.name}: ${result.error}`);
      }
      if (assetIds.length > 0) {
        const extra =
          errors.length > 0
            ? ` ${errors.length} file(s) skipped: ${errors.slice(0, 2).join("; ")}`
            : "";
        setMessage(
          assetIds.length === 1 ? `Added 1 image.${extra}` : `Added ${assetIds.length} images.${extra}`
        );
        await onRefresh(assetIds);
      } else {
        setMessage(errors[0] ?? "Upload failed.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const lower = msg.toLowerCase();
      if (lower.includes("body exceeded") || lower.includes("413") || lower.includes("too large")) {
        setMessage("Upload too large for the server (max 20MB per image). Try a smaller photo or lower camera resolution.");
      } else {
        setMessage(msg || "Upload failed. Check your connection and try again.");
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          disabled={busy}
          onChange={(e) => void handleFilesSelected(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          size={btnSize}
          className={cn(h, "gap-1.5")}
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2Icon className="size-3.5 shrink-0 animate-spin" />
          ) : (
            <UploadIcon className="size-3.5 shrink-0" />
          )}
          {atLimit ? "Upload (limit)" : "Upload"}
        </Button>
        <GoogleDriveFolderPicker
          onFilesPicked={async (fileIds, accessToken) => {
            setMessage(null);
            setDriveBusy(true);
            try {
              const result = await importFilesFromGoogleDrive(fileIds, accessToken, attachProjectId ?? undefined);
              if (result.ok && result.assets.length > 0) {
                setMessage(`Imported ${result.assets.length} image(s) from Drive.`);
                await onRefresh(result.assets.map((a) => a.id));
              } else if (!result.ok) {
                setMessage(result.error);
              } else {
                setMessage("No images could be imported from that folder.");
              }
            } finally {
              setDriveBusy(false);
            }
          }}
          onError={(err) => setMessage(err)}
          variant="outline"
          size={btnSize}
          className={cn(h)}
          disabled={busy}
        >
          {driveBusy ? (
            <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />
          ) : (
            <ImageIcon className="mr-1.5 size-3.5" />
          )}
          Drive folder
        </GoogleDriveFolderPicker>
        <GoogleDriveMultiFilePicker
          onFilesPicked={async (fileIds, accessToken) => {
            setMessage(null);
            setDriveBusy(true);
            try {
              const result = await importFilesFromGoogleDrive(fileIds, accessToken, attachProjectId ?? undefined);
              if (result.ok && result.assets.length > 0) {
                setMessage(`Imported ${result.assets.length} image(s) from Drive.`);
                await onRefresh(result.assets.map((a) => a.id));
              } else if (!result.ok) {
                setMessage(result.error);
              } else {
                setMessage("No images could be imported.");
              }
            } finally {
              setDriveBusy(false);
            }
          }}
          onError={(err) => setMessage(err)}
          variant="outline"
          size={btnSize}
          className={cn(h)}
          disabled={busy}
        >
          {driveBusy ? (
            <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />
          ) : (
            <ImageIcon className="mr-1.5 size-3.5" />
          )}
          Drive images
        </GoogleDriveMultiFilePicker>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Pick several files at once. In Drive, click multiple images (or Ctrl/Cmd+click), then Select.
      </p>
      {message && (
        <p
          className={cn(
            "text-xs",
            message.toLowerCase().includes("limit") || message.toLowerCase().includes("failed") || message.toLowerCase().includes("error")
              ? "text-destructive"
              : "text-muted-foreground"
          )}
        >
          {message}
        </p>
      )}
    </div>
  );
}
