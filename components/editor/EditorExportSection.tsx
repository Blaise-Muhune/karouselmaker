"use client";

import { useState, useEffect } from "react";
import { updateExportSettings } from "@/app/actions/carousels/updateExportFormat";
import type { ExportFormat, ExportSize } from "@/lib/server/db/types";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DownloadIcon, Loader2Icon } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UpgradeBanner } from "@/components/subscription/UpgradeBanner";
import { WaitingGamesDialog } from "@/components/waiting/WaitingGamesDialog";
import { PLAN_LIMITS } from "@/lib/constants";
import { slugifyForFilename } from "@/lib/utils";
import { triggerBlobDownload } from "@/lib/client/blobDownload";

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
  "1080x1350": "4:5",
  "1080x1920": "9:16",
};

type EditorExportSectionProps = {
  carouselId: string;
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
  isPro = true,
  exportsUsedThisMonth = 0,
  exportsLimit,
  exportFormat = "png",
  exportSize = "1080x1350",
  recentExports: _recentExports,
  captionVariants: _captionVariants = {},
  hashtags: _hashtags = [],
  disabled = false,
  carouselTitle,
  projectName,
  exportSettingsPath,
}: EditorExportSectionProps) {
  void _recentExports;
  void _captionVariants;
  void _hashtags;
  const downloadSlug =
    slugifyForFilename([projectName, carouselTitle].filter(Boolean).join(" - ")) || "carousel";
  const limit =
    exportsLimit ?? (isPro ? PLAN_LIMITS.pro.exportsPerMonth : PLAN_LIMITS.free.exportsPerMonth);
  const canExport = exportsUsedThisMonth < limit;
  const router = useRouter();
  const initialFormat: "png" | "jpeg" = exportFormat === "jpeg" ? "jpeg" : "png";
  const [localExportFormat, setLocalExportFormat] = useState<"png" | "jpeg">(initialFormat);
  const [localExportSize, setLocalExportSize] = useState<ExportSize>(exportSize);
  const [updatingExportSettings, setUpdatingExportSettings] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    setLocalExportFormat(exportFormat === "jpeg" ? "jpeg" : "png");
  }, [exportFormat]);
  useEffect(() => {
    setLocalExportSize(exportSize);
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
      const ext = localExportFormat === "jpeg" ? "zip" : "zip";
      const filename = `${downloadSlug}.${ext}`;
      await triggerBlobDownload(blob, filename);
      router.refresh();
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="space-y-3">
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Export for IG & TikTok</p>
      {!canExport && (
        <UpgradeBanner message={`You've used ${exportsUsedThisMonth}/${limit} exports this month. Upgrade for more.`} />
      )}
      <div className="flex flex-wrap items-end gap-3">
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
            <SelectTrigger className="w-[120px]">
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
        <Button type="button" disabled={!canExport || disabled || exporting} onClick={() => void handleDownload()}>
          {exporting ? <Loader2Icon className="mr-2 size-4 animate-spin" /> : <DownloadIcon className="mr-2 size-4" />}
          Download ZIP
        </Button>
        {exporting && (
          <WaitingGamesDialog loadingMessage="Building your ZIP…" triggerClassName="bg-background/80" />
        )}
      </div>
      {exportError && <p className="text-destructive text-sm">{exportError}</p>}
      <p className="text-muted-foreground text-xs">
        {exportsUsedThisMonth}/{limit} exports this month
      </p>
    </section>
  );
}
