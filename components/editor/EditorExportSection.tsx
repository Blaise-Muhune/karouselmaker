"use client";

import { useState, useRef, useEffect } from "react";
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
import {
  createVideoFromImages,
  createVideoFromLayeredSlides,
  preloadFFmpeg,
  type CaptionPosition,
  type LayeredSlideInput,
} from "@/lib/video/createVideoFromImages";
import { VOICE_PRESETS } from "@/lib/video/voices";
import { DownloadIcon, Loader2Icon, Pause, PlayIcon, VideoIcon } from "lucide-react";
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
  const [slideVideoData, setSlideVideoData] = useState<LayeredSlideInput[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [videoPreviewOpen, setVideoPreviewOpen] = useState(false);
  const [videoUrlsLoading, setVideoUrlsLoading] = useState(false);
  const [videoDownloading, setVideoDownloading] = useState(false);
  const [videoDownloadProgress, setVideoDownloadProgress] = useState(0);
  const [videoDownloadStep, setVideoDownloadStep] = useState<string>("");
  const [videoDownloadError, setVideoDownloadError] = useState<string | null>(null);
  const [captionPosition, setCaptionPosition] = useState<CaptionPosition>("bottom_center");
  const [withCaption, setWithCaption] = useState(false);
  const [zipDownloading, setZipDownloading] = useState(false);
  const [withVoiceover, setWithVoiceover] = useState(false);
  const [selectedVoiceId, setSelectedVoiceId] = useState(VOICE_PRESETS[0]!.voiceId);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [generatedVideoBlob, setGeneratedVideoBlob] = useState<Blob | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isStandalonePWA = useIsStandalonePWA();

  const latestReadyExport = recentExports.find((ex) => ex.status === "ready");

  // Revoke object URL when dialog closes or component unmounts
  useEffect(() => {
    return () => {
      if (generatedVideoUrl) {
        URL.revokeObjectURL(generatedVideoUrl);
      }
    };
  }, [generatedVideoUrl]);

  // Captions require voiceover (TTS); keep state in sync
  useEffect(() => {
    if (!withVoiceover) setWithCaption(false);
  }, [withVoiceover]);

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    setDownloadUrl(null);
    setSlideUrls([]);
    setSlideVideoData(null);
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

  const loadVideoUrls = async (): Promise<{ urls: string[]; videoData: LayeredSlideInput[] | null }> => {
    const hasCompleteVideoData =
      slideVideoData != null &&
      slideVideoData.length === slideUrls.length &&
      slideVideoData.every((s) => s.backgroundUrls?.length);
    if (slideUrls.length > 0 && hasCompleteVideoData) {
      return { urls: slideUrls, videoData: slideVideoData };
    }
    if (!latestReadyExport) return { urls: slideUrls.length > 0 ? slideUrls : [], videoData: null };
    setVideoUrlsLoading(true);
    try {
      const res = await fetch(`/api/export/${carouselId}/${latestReadyExport.id}/slide-urls`);
      const data = await res.json().catch(() => ({}));
      if (data.slideUrls?.length) {
        setSlideUrls(data.slideUrls);
        const vd =
          Array.isArray(data.slideVideoData) && data.slideVideoData.length === data.slideUrls.length
            ? (data.slideVideoData as LayeredSlideInput[])
            : null;
        setSlideVideoData(vd);
        return { urls: data.slideUrls as string[], videoData: vd };
      }
      return { urls: slideUrls, videoData: null };
    } finally {
      setVideoUrlsLoading(false);
    }
  };

  const handleDownloadVideo = async () => {
    const { urls, videoData } = await loadVideoUrls();
    if (urls.length === 0) return;
    const previousVideoUrl = generatedVideoUrl;
    setVideoDownloading(true);
    setVideoDownloadError(null);
    setVideoDownloadProgress(0);
    setVideoDownloadStep("");
    try {
      const width = exportSize === "1080x1080" ? 1080 : 1080;
      const height = exportSize === "1080x1080" ? 1080 : exportSize === "1080x1350" ? 1350 : 1920;
      let audioBuffer: ArrayBuffer | undefined;
      let slideDurationsSec: number[] | undefined;
      let captionCues: { text: string; start: number; end: number }[] | undefined;
      if (withVoiceover) {
        const ttsRes = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            carouselId,
            voiceId: selectedVoiceId,
            timestamps: true,
          }),
        });
        if (!ttsRes.ok) {
          const err = await ttsRes.json().catch(() => ({}));
          throw new Error(err.error ?? "Voiceover failed. Add ELEVENLABS_API_KEY in env.");
        }
        const ttsData = (await ttsRes.json()) as {
          audioBase64?: string;
          captionCues?: { text: string; start: number; end: number }[];
          slideDurationsSec?: number[];
        };
        if (ttsData.audioBase64) {
          const binary = atob(ttsData.audioBase64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          audioBuffer = bytes.buffer;
          slideDurationsSec = ttsData.slideDurationsSec;
          // Only use caption cues when user opted in to captions
          if (withCaption) captionCues = ttsData.captionCues;
        }
      }
      const blob = videoData?.every((s) => s.backgroundUrls?.length)
        ? await createVideoFromLayeredSlides(
            videoData,
            width,
            height,
            setVideoDownloadProgress,
            withVoiceover && audioBuffer
              ? {
                  audioBuffer,
                  slideDurationsSec,
                  ...(withCaption && captionCues
                    ? { captionCues, captionPosition }
                    : {}),
                  onStep: setVideoDownloadStep,
                }
              : {
                  onStep: setVideoDownloadStep,
                }
          )
        : await createVideoFromImages(urls, width, height, setVideoDownloadProgress);
      // Keep blob and URL so we can show a real <video> with play/pause and re-download
      setGeneratedVideoBlob(blob);
      if (previousVideoUrl) URL.revokeObjectURL(previousVideoUrl);
      setGeneratedVideoUrl(URL.createObjectURL(blob));
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = "carousel.mp4";
      a.click();
      URL.revokeObjectURL(downloadUrl);
    } catch (e) {
      setVideoDownloadError(e instanceof Error ? e.message : "Video download failed");
    } finally {
      setVideoDownloading(false);
      setVideoDownloadProgress(0);
      setVideoDownloadStep("");
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
      {exporting && (
        <div className="mb-4 flex flex-col items-center justify-center gap-4 rounded-lg border bg-muted/30 py-8 px-4 min-h-[180px]">
          <Loader2Icon className="size-14 animate-spin text-primary" aria-hidden />
          <div className="text-center space-y-1">
            <p className="font-medium text-foreground">Exporting…</p>
            <p className="text-muted-foreground text-sm">
              Don&apos;t close this window until the export has finished.
            </p>
            <WaitingGamesDialog loadingMessage="Your export is still in progress…" />
          </div>
        </div>
      )}
      <div className={`flex flex-wrap items-center gap-3 transition-opacity ${exporting ? "pointer-events-none opacity-50" : ""}`} aria-disabled={exporting}>
        {downloadUrl && (
          <div className="flex flex-wrap items-center gap-2">
            {isStandalonePWA ? (
              <Button
                size="sm"
                onClick={handleDownloadZipInPWA}
                disabled={zipDownloading || exporting}
                loading={zipDownloading}
              >
                <DownloadIcon className="mr-2 size-4" />
                {zipDownloading ? "Downloading…" : "Download ZIP"}
              </Button>
            ) : (
              <Button asChild size="sm" disabled={exporting}>
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
              const hasComplete =
                slideVideoData != null &&
                slideVideoData.length === slideUrls.length &&
                slideVideoData.every((s) => s.backgroundUrls?.length);
              if (slideUrls.length === 0 || !hasComplete) loadVideoUrls();
              preloadFFmpeg(); // Start loading FFmpeg so Download MP4 is faster
            } else {
              setGeneratedVideoUrl(null);
              setGeneratedVideoBlob(null);
            }
          }}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" disabled={exporting}>
                <PlayIcon className="mr-2 size-4" />
                Video preview
              </Button>
            </DialogTrigger>
            <DialogContent
              className="max-w-2xl"
              showCloseButton={!videoDownloading}
              onInteractOutside={(e) => {
                if (videoDownloading) e.preventDefault();
              }}
              onEscapeKeyDown={(e) => {
                if (videoDownloading) e.preventDefault();
              }}
            >
              <DialogHeader>
                <DialogTitle>Carousel video preview</DialogTitle>
              </DialogHeader>
              <div className="flex justify-center py-4 rounded-lg overflow-hidden bg-black/5">
                {videoDownloading ? (
                  <div className="flex flex-col items-center justify-center gap-4 py-8 px-4 w-full min-h-[200px]">
                    <Loader2Icon className="size-14 animate-spin text-primary" aria-hidden />
                    <div className="text-center space-y-1">
                      <p className="font-medium text-foreground">
                        {videoDownloadStep || "Generating video…"}
                        {videoDownloadProgress > 0 ? ` ${Math.round(videoDownloadProgress * 100)}%` : ""}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        Don&apos;t close this window until the video has finished generating.
                      </p>
                      <WaitingGamesDialog loadingMessage="Your video is still encoding…" />
                    </div>
                  </div>
                ) : videoUrlsLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2Icon className="size-5 animate-spin" />
                    Loading…
                  </div>
                ) : generatedVideoUrl ? (
                  <video
                    ref={videoRef}
                    src={generatedVideoUrl}
                    controls
                    playsInline
                    className="max-h-[60vh] w-full rounded-lg"
                  />
                ) : (
                  <CarouselVideoPlayer
                    slideUrls={slideUrls}
                    slideVideoData={slideVideoData}
                    width={exportSize === "1080x1080" ? 1080 : 1080}
                    height={exportSize === "1080x1080" ? 1080 : exportSize === "1080x1350" ? 1350 : 1920}
                  />
                )}
              </div>
              <div className="flex flex-col items-center gap-4 mt-4">
                <div
                  className={`flex flex-wrap items-center justify-center gap-4 w-full transition-opacity ${videoDownloading ? "pointer-events-none opacity-50" : ""}`}
                  aria-disabled={videoDownloading}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="voiceover"
                      checked={withVoiceover}
                      onChange={(e) => setWithVoiceover(e.target.checked)}
                      disabled={videoDownloading}
                      className="rounded border-input accent-primary"
                    />
                    <Label htmlFor="voiceover" className="text-sm font-medium cursor-pointer">
                      With voiceover
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="with-caption"
                      checked={withCaption}
                      disabled={!withVoiceover || videoDownloading}
                      onChange={(e) => setWithCaption(e.target.checked)}
                      className="rounded border-input accent-primary disabled:opacity-50"
                    />
                    <Label htmlFor="with-caption" className={`text-sm font-medium cursor-pointer ${!withVoiceover ? "text-muted-foreground" : ""}`}>
                      With caption
                    </Label>
                  </div>
                  {withVoiceover && (
                    <>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="voice-select" className="text-sm text-muted-foreground whitespace-nowrap">
                          Voice
                        </Label>
                        <Select
                          value={selectedVoiceId}
                          onValueChange={setSelectedVoiceId}
                        >
                          <SelectTrigger id="voice-select" className="w-[180px]" disabled={videoDownloading}>
                            <SelectValue placeholder="Pick a voice" />
                          </SelectTrigger>
                          <SelectContent>
                            {VOICE_PRESETS.map((v) => (
                              <SelectItem key={v.id} value={v.voiceId}>
                                {v.name}
                                {v.description ? ` — ${v.description}` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="caption-pos" className="text-sm text-muted-foreground whitespace-nowrap">
                          Caption position
                        </Label>
                        <Select
                          value={captionPosition}
                          onValueChange={(v) => setCaptionPosition(v as CaptionPosition)}
                        >
                          <SelectTrigger id="caption-pos" className="w-[160px]" disabled={videoDownloading}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="bottom_center">Bottom center</SelectItem>
                            <SelectItem value="lower_third">Lower third</SelectItem>
                            <SelectItem value="center">Center</SelectItem>
                            <SelectItem value="safe_lower">Safe lower (above platform buttons)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                </div>
                <div className={`flex items-center gap-2 flex-wrap justify-center ${videoDownloading ? "pointer-events-none opacity-50" : ""}`}>
                  {generatedVideoUrl && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => videoRef.current?.play()}
                        aria-label="Play"
                      >
                        <PlayIcon className="mr-2 size-4" />
                        Play
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => videoRef.current?.pause()}
                        aria-label="Pause"
                      >
                        <Pause className="mr-2 size-4" />
                        Pause
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (!generatedVideoBlob) return;
                          const url = URL.createObjectURL(generatedVideoBlob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = "carousel.mp4";
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        disabled={!generatedVideoBlob}
                      >
                        <DownloadIcon className="mr-2 size-4" />
                        Download MP4
                      </Button>
                    </>
                  )}
                  {!generatedVideoUrl && (
                    <Button
                      size="sm"
                      onClick={handleDownloadVideo}
                      disabled={slideUrls.length === 0 || videoDownloading || videoUrlsLoading}
                    >
                      {videoDownloading ? (
                        <>
                          <Loader2Icon className="mr-2 size-4 animate-spin" />
                          {videoDownloadStep
                            ? `${videoDownloadStep} ${videoDownloadProgress > 0 ? Math.round(videoDownloadProgress * 100) + "%" : ""}`
                            : "Loading FFmpeg…"}
                        </>
                      ) : (
                        <>
                          <VideoIcon className="mr-2 size-4" />
                          Generate & download MP4
                        </>
                      )}
                    </Button>
                  )}
                </div>
                {videoDownloadError && (
                  <p className="text-destructive text-xs">{videoDownloadError}</p>
                )}
                <p className="text-muted-foreground text-xs text-center">
                  {videoDownloading
                    ? "Keep this window open until the video finishes generating."
                    : generatedVideoUrl
                      ? "Use the video controls to play, pause, and seek. Download again if needed."
                      : "Encodes in browser · Open this dialog first for faster download"}
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
        <div className="mt-2 space-y-1">
          <p className="text-destructive text-sm">{error}</p>
          <p className="text-muted-foreground text-sm">
            You can download each slide as an image using the Download button under each slide below.
          </p>
        </div>
      )}
      {!error && recentExports.some((ex) => ex.status === "failed") && (
        <p className="text-muted-foreground mt-2 text-sm">
          A recent export failed. You can download each slide individually using the Download button under each slide below.
        </p>
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
