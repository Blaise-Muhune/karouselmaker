"use client";

import { useState, useEffect, useCallback } from "react";
import { updateExportSettings } from "@/app/actions/carousels/updateExportFormat";
import type { ExportSize } from "@/lib/server/db/types";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckIcon, CopyIcon, DownloadIcon, Loader2Icon, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WaitingGamesDialog } from "@/components/waiting/WaitingGamesDialog";
import { slugifyForFilename } from "@/lib/utils";
import { triggerBlobDownload } from "@/lib/client/blobDownload";
import { combineCaptionWithHashtags } from "@/components/editor/EditorCaptionSection";

export type ExportRowDisplay = {
  id: string;
  status: string;
  storage_path: string | null;
  created_at: string;
};

const EXPORT_FORMAT_LABELS: Record<"png" | "jpeg", string> = {
  png: "PNG",
  jpeg: "JPEG",
};

const EXPORT_SIZE_LABELS: Record<ExportSize, string> = {
  "1080x1080": "1:1",
  "1080x1350": "4:5 (feed)",
  "1080x1920": "9:16 (story)",
};

type EditorExportSectionProps = {
  carouselId: string;
  /** Retained for callers while exports are no longer plan-metered. */
  isPro?: boolean;
  exportsUsedThisMonth?: number;
  exportsLimit?: number;
  exportFormat?: "png" | "jpeg" | "pdf";
  exportSize?: "1080x1080" | "1080x1350" | "1080x1920";
  recentExports: ExportRowDisplay[];
  isAdmin?: boolean;
  postToPlatforms?: Record<string, boolean>;
  connectedPlatforms?: string[];
  captionVariants?: { title?: string; medium?: string; long?: string; short?: string; spicy?: string };
  hashtags?: string[];
  disabled?: boolean;
  carouselTitle?: string;
  projectName?: string;
  exportSettingsPath?: string;
};

export function EditorExportSection({
  carouselId,
  isPro: _isPro = true,
  exportsUsedThisMonth: _exportsUsedThisMonth = 0,
  exportsLimit: _exportsLimit,
  exportFormat = "png",
  exportSize = "1080x1350",
  recentExports: _recentExports,
  captionVariants = {},
  hashtags = [],
  disabled = false,
  carouselTitle,
  projectName,
  exportSettingsPath,
}: EditorExportSectionProps) {
  void _recentExports;
  void _isPro;
  void _exportsUsedThisMonth;
  void _exportsLimit;
  const downloadSlug =
    slugifyForFilename([projectName, carouselTitle].filter(Boolean).join(" - ")) || "carousel";
  const canExport = true;
  const router = useRouter();
  const initialFormat: "png" | "jpeg" = exportFormat === "jpeg" ? "jpeg" : "png";
  const [localExportFormat, setLocalExportFormat] = useState<"png" | "jpeg">(initialFormat);
  const [localExportSize, setLocalExportSize] = useState<ExportSize>(exportSize || "1080x1350");
  const [updatingExportSettings, setUpdatingExportSettings] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const captionText = combineCaptionWithHashtags(
    (captionVariants.long || captionVariants.medium || captionVariants.short || "").trim(),
    hashtags
  );

  useEffect(() => {
    setLocalExportFormat(exportFormat === "jpeg" ? "jpeg" : "png");
  }, [exportFormat]);
  useEffect(() => {
    setLocalExportSize(exportSize || "1080x1350");
  }, [exportSize]);

  async function persistSettings(nextFormat: "png" | "jpeg", nextSize: ExportSize) {
    setUpdatingExportSettings(true);
    try {
      await updateExportSettings(
        { carousel_id: carouselId, export_format: nextFormat, export_size: nextSize },
        exportSettingsPath
      );
      router.refresh();
    } finally {
      setUpdatingExportSettings(false);
    }
  }

  async function handleDownload() {
    if (!canExport || disabled) return;
    setExportError(null);
    setExporting(true);
    try {
      const res = await fetch(`/api/export/${carouselId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_overlay: true,
          format: localExportFormat,
          size: localExportSize,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const filename = `${downloadSlug}.zip`;
      await triggerBlobDownload(blob, filename);
      setDownloaded(true);
      window.setTimeout(() => setDownloaded(false), 3000);
      router.refresh();
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  const copyCaption = useCallback(async () => {
    if (!captionText.trim() || disabled) return;
    try {
      await navigator.clipboard.writeText(captionText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }, [captionText, disabled]);

  function selectFormat(value: string) {
    const next = value === "jpeg" ? "jpeg" : "png";
    setLocalExportFormat(next);
    void persistSettings(next, localExportSize);
  }

  function selectSize(value: string) {
    const next = value as ExportSize;
    setLocalExportSize(next);
    void persistSettings(localExportFormat, next);
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm">
      <div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Download your post</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            A ready-to-upload ZIP with every slide.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="lg"
          className="gap-2 sm:min-w-48"
          disabled={!canExport || disabled || exporting}
          onClick={() => void handleDownload()}
        >
          {exporting ? <Loader2Icon className="size-4 animate-spin" /> : downloaded ? <CheckIcon className="size-4" /> : <DownloadIcon className="size-4" />}
          {exporting ? "Building ZIP…" : downloaded ? "ZIP downloaded" : "Download ZIP"}
        </Button>
        {captionText ? (
          <Button type="button" variant="outline" size="lg" className="gap-2" disabled={disabled} onClick={() => void copyCaption()}>
            {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
            {copied ? "Copied" : "Copy caption"}
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={disabled || updatingExportSettings}
              aria-label="Export settings"
              title="Export settings"
            >
              <MoreHorizontal className="size-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>File format</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={localExportFormat} onValueChange={selectFormat}>
              {(Object.keys(EXPORT_FORMAT_LABELS) as Array<"png" | "jpeg">).map((format) => (
                <DropdownMenuRadioItem key={format} value={format} disabled={updatingExportSettings}>
                  {EXPORT_FORMAT_LABELS[format]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Placement</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={localExportSize} onValueChange={selectSize}>
              {(Object.keys(EXPORT_SIZE_LABELS) as ExportSize[]).map((size) => (
                <DropdownMenuRadioItem key={size} value={size} disabled={updatingExportSettings}>
                  {EXPORT_SIZE_LABELS[size]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {exporting && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5" aria-live="polite">
          <p className="text-xs text-muted-foreground">Rendering your slides and packaging the ZIP. Keep this tab open.</p>
          <WaitingGamesDialog loadingMessage="Building your ZIP…" triggerClassName="bg-background/80" />
        </div>
      )}
      {exportError && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          Couldn’t create the ZIP: {exportError}
        </p>
      )}
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {downloaded ? "Your download has started." : `${EXPORT_FORMAT_LABELS[localExportFormat]} · ${EXPORT_SIZE_LABELS[localExportSize]}`}
      </p>
    </section>
  );
}
