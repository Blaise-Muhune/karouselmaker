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
  const [copied, setCopied] = useState<"title" | "caption" | null>(null);
  const [downloaded, setDownloaded] = useState(false);

  const captionText = combineCaptionWithHashtags(
    (captionVariants.long || captionVariants.medium || captionVariants.short || "").trim(),
    hashtags
  );
  const titleText = (captionVariants.title || captionVariants.short || "").trim();

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
    // This happens synchronously within the tap, so mobile Safari/Chrome allow
    // the tab to receive the finished attachment after the render completes.
    const isTouchDevice = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    const downloadWindow = isTouchDevice ? window.open("about:blank", "_blank") : null;
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
          delivery: "prepare",
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `Export failed (${res.status})`);
      }
      const data = (await res.json().catch(() => ({}))) as { downloadUrl?: string; error?: string };
      if (!data.downloadUrl) throw new Error(data.error || "Could not prepare the download");
      if (downloadWindow) {
        downloadWindow.location.replace(data.downloadUrl);
      } else {
        const link = document.createElement("a");
        link.href = data.downloadUrl;
        link.download = `${downloadSlug}.zip`;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      setDownloaded(true);
      window.setTimeout(() => setDownloaded(false), 3000);
    } catch (e) {
      downloadWindow?.close();
      setExportError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  const copyText = useCallback(async (text: string, kind: "title" | "caption") => {
    if (!text.trim() || disabled) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  }, [disabled]);

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
    <section className="space-y-3 rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Ready to publish</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Download the slides, then copy the post text you need.
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-border/70 bg-muted/40 px-2 py-1 text-[11px] font-medium text-muted-foreground">
          {EXPORT_FORMAT_LABELS[localExportFormat]} · {EXPORT_SIZE_LABELS[localExportSize]}
        </span>
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
        {titleText ? (
          <Button type="button" variant="outline" size="lg" className="gap-2" disabled={disabled} onClick={() => void copyText(titleText, "title")}>
            {copied === "title" ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
            {copied === "title" ? "Copied" : "Copy title"}
          </Button>
        ) : null}
        {captionText ? (
          <Button type="button" variant="outline" size="lg" className="gap-2" disabled={disabled} onClick={() => void copyText(captionText, "caption")}>
            {copied === "caption" ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
            {copied === "caption" ? "Copied" : "Copy caption"}
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
          <p className="text-xs text-muted-foreground">Rendering your slides. Your device download will open when it is ready.</p>
          <WaitingGamesDialog loadingMessage="Building your ZIP…" triggerClassName="bg-background/80" />
        </div>
      )}
      {exportError && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          Couldn’t create the ZIP: {exportError}
        </p>
      )}
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {downloaded ? "Your download has started." : "ZIP includes every slide in posting order."}
      </p>
    </section>
  );
}
