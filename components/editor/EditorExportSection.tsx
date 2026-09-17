"use client";

import { useState, useEffect, useCallback } from "react";
import { updateExportSettings } from "@/app/actions/carousels/updateExportFormat";
import type { ExportSize } from "@/lib/server/db/types";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, CopyIcon, DownloadIcon, Loader2Icon } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const [showMore, setShowMore] = useState(false);
  const [copied, setCopied] = useState(false);

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
      const res = await fetch(`/api/export/${carouselId}?format=${localExportFormat}&size=${localExportSize}`, {
        method: "GET",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const filename = `${downloadSlug}.zip`;
      await triggerBlobDownload(blob, filename);
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

  return (
    <section className="space-y-3 rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm">
      <div>
        <p className="text-sm font-semibold text-foreground">Finish & post</p>
        <p className="text-muted-foreground text-xs mt-0.5">
          Download a ZIP for Instagram or TikTok
          {localExportSize === "1080x1350" ? " (4:5 feed)" : ""}.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="lg"
          className="gap-2"
          disabled={!canExport || disabled || exporting}
          onClick={() => void handleDownload()}
        >
          {exporting ? <Loader2Icon className="size-4 animate-spin" /> : <DownloadIcon className="size-4" />}
          Download for Instagram & TikTok
        </Button>
        {captionText ? (
          <Button type="button" variant="outline" size="lg" className="gap-2" disabled={disabled} onClick={() => void copyCaption()}>
            {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
            {copied ? "Copied" : "Copy caption"}
          </Button>
        ) : null}
        {exporting && (
          <WaitingGamesDialog loadingMessage="Building your ZIP…" triggerClassName="bg-background/80" />
        )}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-ml-1 text-muted-foreground"
        onClick={() => setShowMore((v) => !v)}
      >
        {showMore ? <ChevronUpIcon className="mr-1.5 size-4" /> : <ChevronDownIcon className="mr-1.5 size-4" />}
        {showMore ? "Hide format options" : "Format & size"}
      </Button>
      {showMore && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Format</Label>
            <Select
              value={localExportFormat}
              disabled={disabled || updatingExportSettings}
              onValueChange={(v) => {
                const next = v === "jpeg" ? "jpeg" : "png";
                setLocalExportFormat(next);
                void persistSettings(next, localExportSize);
              }}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(EXPORT_FORMAT_LABELS) as Array<"png" | "jpeg">).map((k) => (
                  <SelectItem key={k} value={k}>
                    {EXPORT_FORMAT_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Size</Label>
            <Select
              value={localExportSize}
              disabled={disabled || updatingExportSettings}
              onValueChange={(v) => {
                const next = v as ExportSize;
                setLocalExportSize(next);
                void persistSettings(localExportFormat, next);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(EXPORT_SIZE_LABELS) as ExportSize[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {EXPORT_SIZE_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
      {exportError && <p className="text-destructive text-sm">{exportError}</p>}
      <p className="text-muted-foreground text-xs">
        Downloads do not use a post pack · default {EXPORT_FORMAT_LABELS[localExportFormat]}{" "}
        {EXPORT_SIZE_LABELS[localExportSize]}
      </p>
    </section>
  );
}
