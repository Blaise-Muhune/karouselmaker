"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DownloadIcon, Loader2Icon } from "lucide-react";
import { UpgradeBanner } from "@/components/subscription/UpgradeBanner";
import { PLAN_LIMITS } from "@/lib/constants";

export type ExportRowDisplay = {
  id: string;
  status: string;
  storage_path: string | null;
  created_at: string;
};

type EditorExportSectionProps = {
  carouselId: string;
  isPro?: boolean;
  /** Number of exports used this month. */
  exportsUsedThisMonth?: number;
  /** Export limit for current plan. */
  exportsLimit?: number;
  exportFormat?: "png" | "jpeg";
  exportSize?: "1080x1080" | "1080x1350" | "1080x1920";
  recentExports: ExportRowDisplay[];
};

export function EditorExportSection({
  carouselId,
  isPro = true,
  exportsUsedThisMonth = 0,
  exportsLimit,
  exportFormat = "png",
  exportSize = "1080x1350",
  recentExports,
}: EditorExportSectionProps) {
  const limit = exportsLimit ?? (isPro ? PLAN_LIMITS.pro.exportsPerMonth : PLAN_LIMITS.free.exportsPerMonth);
  const canExport = exportsUsedThisMonth < limit;
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    setDownloadUrl(null);
    try {
      const res = await fetch(`/api/export/${carouselId}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Export failed");
        return;
      }
      if (data.downloadUrl) {
        setDownloadUrl(data.downloadUrl);
        router.refresh();
      }
    } catch {
      setError("Export failed");
    } finally {
      setExporting(false);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(undefined, {
        dateStyle: "short",
        timeStyle: "short",
      });
    } catch {
      return iso;
    }
  };

  return (
    <section>
      <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
        Export
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {downloadUrl && (
          <Button asChild size="sm">
            <a href={downloadUrl} download="carousel.zip" target="_blank" rel="noopener noreferrer">
              <DownloadIcon className="mr-2 size-4" />
              Download ZIP
            </a>
          </Button>
        )}
        <Button
          size="sm"
          onClick={handleExport}
          disabled={!canExport || exporting}
        >
          {exporting ? (
            <Loader2Icon className="mr-2 size-4 animate-spin" />
          ) : (
            <DownloadIcon className="mr-2 size-4" />
          )}
          {exporting ? "Exporting…" : downloadUrl ? "Export again" : "Export"}
        </Button>
        {canExport && (
          <span className="text-muted-foreground text-xs">
            {exportsUsedThisMonth}/{limit} this month
          </span>
        )}
      </div>
      {!canExport && (
        isPro ? (
          <p className="text-muted-foreground mt-3 text-sm">
            Export limit reached. Resets next month.
          </p>
        ) : (
          <div className="mt-3">
            <UpgradeBanner
              message={
                exportsUsedThisMonth >= limit
                  ? `You've used your ${limit} free exports this month. Upgrade to Pro for ${PLAN_LIMITS.pro.exportsPerMonth}/month.`
                  : `Free: ${exportsUsedThisMonth}/${limit} exports this month. Upgrade to Pro for ${PLAN_LIMITS.pro.exportsPerMonth}/month.`
              }
              variant="inline"
            />
          </div>
        )
      )}
      {error && (
        <p className="text-destructive mt-2 text-sm">{error}</p>
      )}
      {recentExports.length > 0 && (
        <ul className="mt-3 space-y-1">
          {recentExports.map((ex) => (
            <li key={ex.id} className="flex items-center gap-2 text-sm">
              <span
                className={
                  ex.status === "ready"
                    ? "text-green-600 dark:text-green-400"
                    : ex.status === "failed"
                      ? "text-destructive"
                      : "text-muted-foreground"
                }
              >
                {ex.status}
              </span>
              <span className="text-muted-foreground">{formatDate(ex.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
