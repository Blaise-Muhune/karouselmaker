"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { uploadAssets } from "@/app/actions/assets/uploadAsset";
import { importFromGoogleDrive, importFilesFromGoogleDrive } from "@/app/actions/assets/importFromGoogleDrive";
import { GoogleDriveFolderPicker } from "@/components/drive/GoogleDriveFolderPicker";
import { GoogleDriveMultiFilePicker } from "@/components/drive/GoogleDriveMultiFilePicker";
import { ImageIcon, Loader2Icon, UploadIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type LibraryImageImportBarProps = {
  /** New uploads and Drive imports are tagged with this project (omit or null = global library). */
  attachProjectId?: string | null;
  /** Called after a successful add so the parent can refetch the library. */
  onRefresh: () => void | Promise<void>;
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

  async function handleFilesSelected(files: FileList | null) {
    if (!files?.length || atLimit) return;
    setMessage(null);
    setUploading(true);
    try {
      const fd = new FormData();
      for (const f of Array.from(files)) {
        if (f) fd.append("files", f);
      }
      if (attachProjectId?.trim()) fd.set("project_id", attachProjectId.trim());
      const result = await uploadAssets(fd, revalidatePathname);
      if (result.ok) {
        const extra =
          result.errors.length > 0
            ? ` ${result.errors.length} file(s) skipped: ${result.errors.map((e) => e.error).slice(0, 2).join("; ")}`
            : "";
        setMessage(
          result.assetIds.length === 1
            ? `Added 1 image.${extra}`
            : `Added ${result.assetIds.length} images.${extra}`
        );
        await onRefresh();
      } else {
        setMessage(result.error);
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
          onFolderPicked={async (folderId, accessToken) => {
            setMessage(null);
            setDriveBusy(true);
            try {
              const result = await importFromGoogleDrive(folderId, accessToken, attachProjectId ?? undefined);
              if (result.ok && result.assets.length > 0) {
                setMessage(`Imported ${result.assets.length} image(s) from Drive.`);
                await onRefresh();
              } else if (!result.ok) {
                setMessage(result.error);
              } else {
                setMessage("No images imported from that folder.");
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
                await onRefresh();
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
          <ImageIcon className="mr-1.5 size-3.5" />
          Drive files
        </GoogleDriveMultiFilePicker>
      </div>
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
