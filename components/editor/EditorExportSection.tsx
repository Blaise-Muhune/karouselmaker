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

export type ExportRowDisplay = {
  id: string;
  status: string;
  storage_path: string | null;
  created_at: string;
};

type EditorExportSectionProps = {
  carouselId: string;
  recentExports: ExportRowDisplay[];
};

export function EditorExportSection({
  carouselId,
  recentExports,
}: EditorExportSectionProps) {
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
            Generate 1080×1080 PNGs and download as ZIP.
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
            disabled={exporting}
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
