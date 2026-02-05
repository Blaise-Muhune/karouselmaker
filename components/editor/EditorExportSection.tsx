"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  exportSize = "1080x1080",
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
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base">Export</CardTitle>
          <CardDescription>
            Generate {exportSize.replace("x", "×")} {exportFormat.toUpperCase()}s and download as ZIP.
            {canExport && (
              <span className="block mt-1 text-muted-foreground/80">
                {exportsUsedThisMonth}/{limit} exports used this month
              </span>
            )}
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!canExport && (
          isPro ? (
            <p className="text-muted-foreground rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
              You&apos;ve used your {limit} exports this month. Limit resets next month.
            </p>
          ) : (
            <UpgradeBanner
              message={
                exportsUsedThisMonth >= limit
                  ? `You've used your ${limit} free exports this month. Upgrade to Pro for ${PLAN_LIMITS.pro.exportsPerMonth}/month.`
                  : `Free: ${exportsUsedThisMonth}/${limit} exports this month. Upgrade to Pro for ${PLAN_LIMITS.pro.exportsPerMonth}/month.`
              }
              variant="inline"
            />
          )
        )}
        {error && (
          <p className="text-destructive text-sm">{error}</p>
        )}
        {recentExports.length > 0 && (
          <div>
            <p className="text-muted-foreground mb-2 text-xs font-medium">Recent exports</p>
            <ul className="space-y-1 text-sm">
              {recentExports.map((ex) => (
                <li key={ex.id} className="flex items-center gap-2">
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
