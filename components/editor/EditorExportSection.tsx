"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useIsStandalonePWA } from "@/lib/hooks/useIsStandalonePWA";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CarouselVideoPlayer } from "@/components/carousels/CarouselVideoPlayer";
import { createVideoFromImages, preloadFFmpeg } from "@/lib/video/createVideoFromImages";
import { DownloadIcon, Loader2Icon, PlayIcon, VideoIcon } from "lucide-react";
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
  const [slideUrls, setSlideUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [videoPreviewOpen, setVideoPreviewOpen] = useState(false);
  const [videoUrlsLoading, setVideoUrlsLoading] = useState(false);
  const [videoDownloading, setVideoDownloading] = useState(false);
  const [videoDownloadProgress, setVideoDownloadProgress] = useState(0);
  const [videoDownloadError, setVideoDownloadError] = useState<string | null>(null);
  const [zipDownloading, setZipDownloading] = useState(false);
  const isStandalonePWA = useIsStandalonePWA();

  const latestReadyExport = recentExports.find((ex) => ex.status === "ready");

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    setDownloadUrl(null);
    setSlideUrls([]);
    try {
      const res = await fetch(`/api/export/${carouselId}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Export failed");
        return;
      }
      if (data.downloadUrl) {
        setDownloadUrl(data.downloadUrl);
        if (data.slideUrls?.length) setSlideUrls(data.slideUrls);
        router.refresh();
      }
    } catch {
      setError("Export failed");
    } finally {
      setExporting(false);
    }
  };

  const loadVideoUrls = async (): Promise<string[]> => {
    if (slideUrls.length > 0) return slideUrls;
    if (!latestReadyExport) return [];
    setVideoUrlsLoading(true);
    try {
      const res = await fetch(`/api/export/${carouselId}/${latestReadyExport.id}/slide-urls`);
      const data = await res.json().catch(() => ({}));
      if (data.slideUrls?.length) {
        setSlideUrls(data.slideUrls);
        return data.slideUrls as string[];
      }
      return [];
    } finally {
      setVideoUrlsLoading(false);
    }
  };

  const handleDownloadVideo = async () => {
    const urls = await loadVideoUrls();
    if (urls.length === 0) return;
    setVideoDownloading(true);
    setVideoDownloadError(null);
    setVideoDownloadProgress(0);
    try {
      const width = exportSize === "1080x1080" ? 1080 : 1080;
      const height = exportSize === "1080x1080" ? 1080 : exportSize === "1080x1350" ? 1350 : 1920;
      const blob = await createVideoFromImages(urls, width, height, setVideoDownloadProgress);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "carousel.mp4";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setVideoDownloadError(e instanceof Error ? e.message : "Video download failed");
    } finally {
      setVideoDownloading(false);
      setVideoDownloadProgress(0);
    }
  };

  /** In PWA, fetch zip and trigger download in-place so we don't open browser. */
  const handleDownloadZipInPWA = async () => {
    if (!downloadUrl) return;
    setZipDownloading(true);
    setError(null);
    try {
      const res = await fetch(downloadUrl);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "carousel.zip";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Download failed. Try opening in browser.");
    } finally {
      setZipDownloading(false);
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
          <div className="flex flex-wrap items-center gap-2">
            {isStandalonePWA ? (
              <Button
                size="sm"
                onClick={handleDownloadZipInPWA}
                disabled={zipDownloading}
                loading={zipDownloading}
              >
                <DownloadIcon className="mr-2 size-4" />
                {zipDownloading ? "Downloading…" : "Download ZIP"}
              </Button>
            ) : (
              <Button asChild size="sm">
                <a href={downloadUrl} download="carousel.zip" target="_blank" rel="noopener noreferrer">
                  <DownloadIcon className="mr-2 size-4" />
                  Download ZIP
                </a>
              </Button>
            )}
          </div>
        )}
        <Button
          size="sm"
          onClick={handleExport}
          disabled={!canExport || exporting}
          loading={exporting}
        >
          {exporting ? (
            "Exporting…"
          ) : (
            <>
              <DownloadIcon className="mr-2 size-4" />
              {downloadUrl ? "Export again" : "Export"}
            </>
          )}
        </Button>
        {latestReadyExport && (
          <Dialog open={videoPreviewOpen} onOpenChange={(open) => {
            setVideoPreviewOpen(open);
            if (open) {
              if (slideUrls.length === 0) loadVideoUrls();
              preloadFFmpeg(); // Start loading FFmpeg so Download MP4 is faster
            }
          }}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <PlayIcon className="mr-2 size-4" />
                Video preview
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Carousel video preview</DialogTitle>
              </DialogHeader>
              <div className="flex justify-center py-4">
                {videoUrlsLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2Icon className="size-5 animate-spin" />
                    Loading…
                  </div>
                ) : (
                  <CarouselVideoPlayer
                    slideUrls={slideUrls}
                    width={exportSize === "1080x1080" ? 1080 : exportSize === "1080x1350" ? 1080 : 1080}
                    height={exportSize === "1080x1080" ? 1080 : exportSize === "1080x1350" ? 1350 : 1920}
                  />
                )}
              </div>
              <div className="flex flex-col items-center gap-2 mt-4">
                <Button
                  size="sm"
                  onClick={handleDownloadVideo}
                  disabled={slideUrls.length === 0 || videoDownloading || videoUrlsLoading}
                >
                  {videoDownloading ? (
                    <>
                      <Loader2Icon className="mr-2 size-4 animate-spin" />
                      {videoDownloadProgress > 0
                        ? `Encoding… ${Math.round(videoDownloadProgress * 100)}%`
                        : "Loading FFmpeg…"}
                    </>
                  ) : (
                    <>
                      <VideoIcon className="mr-2 size-4" />
                      Download MP4
                    </>
                  )}
                </Button>
                {videoDownloadError && (
                  <p className="text-destructive text-xs">{videoDownloadError}</p>
                )}
                <p className="text-muted-foreground text-xs text-center">
                  Encodes in browser · Open this dialog first for faster download
                </p>
              </div>
            </DialogContent>
          </Dialog>
        )}
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
