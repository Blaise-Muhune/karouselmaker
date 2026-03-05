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
import { ADAM_VOICE_ID, VOICE_PRESETS } from "@/lib/video/voices";
import { DownloadIcon, ExternalLinkIcon, Loader2Icon, PlayIcon, RefreshCwIcon, VideoIcon } from "lucide-react";
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
import { PostToTiktokVideoButton } from "@/components/platforms/PostToTiktokVideoButton";
import { PostToFacebookVideoButton } from "@/components/platforms/PostToFacebookVideoButton";
import { PostToInstagramVideoButton } from "@/components/platforms/PostToInstagramVideoButton";
import { PostToYouTubeVideoButton } from "@/components/platforms/PostToYouTubeVideoButton";
import { PlatformIcon } from "@/components/platforms/PlatformIcon";

export type ExportRowDisplay = {
  id: string;
  status: string;
  storage_path: string | null;
  created_at: string;
};

/** Video output size (preview + download). Includes 16:9 and 5:4. */
export type VideoSize = "1080x1080" | "1080x864" | "1080x1350" | "1080x1920" | "1920x1080";

const VIDEO_SIZE_LABELS: Record<VideoSize, string> = {
  "1080x1080": "1:1",
  "1080x864": "5:4",
  "1080x1350": "4:5",
  "1080x1920": "9:16",
  "1920x1080": "16:9",
};

/** Portrait → 1:1 (middle) → landscape */
const VIDEO_SIZE_ORDER: VideoSize[] = ["1080x1920", "1080x1350", "1080x1080", "1080x864", "1920x1080"];

function videoSizeToDimensions(size: VideoSize): { width: number; height: number } {
  switch (size) {
    case "1080x1080":
      return { width: 1080, height: 1080 };
    case "1080x864":
      return { width: 1080, height: 864 };
    case "1080x1350":
      return { width: 1080, height: 1350 };
    case "1080x1920":
      return { width: 1080, height: 1920 };
    case "1920x1080":
      return { width: 1920, height: 1080 };
    default:
      return { width: 1080, height: 1350 };
  }
}

/** Video upload URLs (open in new tab to upload the downloaded MP4). */
const VIDEO_POST_URLS: Record<string, string> = {
  facebook: "https://www.facebook.com/",
  tiktok: "https://www.tiktok.com/upload",
  instagram: "https://www.instagram.com/",
  linkedin: "https://www.linkedin.com/feed/",
  youtube: "https://studio.youtube.com/",
};

const VIDEO_POST_LABELS: Record<string, string> = {
  facebook: "Facebook",
  tiktok: "TikTok",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  youtube: "YouTube",
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
  /** When set (e.g. admin), show "Post video to" in the video preview modal when video is ready. */
  postToPlatforms?: Record<string, boolean>;
  /** Platform keys the user has connected (e.g. from getPlatformConnections). */
  connectedPlatforms?: string[];
};

export function EditorExportSection({
  carouselId,
  isPro = true,
  exportsUsedThisMonth = 0,
  exportsLimit,
  exportFormat = "png",
  exportSize = "1080x1350",
  recentExports,
  postToPlatforms,
  connectedPlatforms = [],
}: EditorExportSectionProps) {
  const connectedSet = new Set(connectedPlatforms);
  const enabledVideoPostPlatforms = postToPlatforms
    ? (["facebook", "tiktok", "instagram", "linkedin", "youtube"] as const).filter((k) => postToPlatforms[k])
    : [];
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
  const [captionPosition, setCaptionPosition] = useState<CaptionPosition>("safe_lower");
  const [withCaption, setWithCaption] = useState(false);
  const [zipDownloading, setZipDownloading] = useState(false);
  const [withVoiceover, setWithVoiceover] = useState(true);
  const [selectedVoiceId, setSelectedVoiceId] = useState(ADAM_VOICE_ID);
  const [voiceSpeed, setVoiceSpeed] = useState(1);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [generatedVideoBlob, setGeneratedVideoBlob] = useState<Blob | null>(null);
  const [videoSize, setVideoSize] = useState<VideoSize>(() =>
    exportSize === "1080x1080" || exportSize === "1080x1350" || exportSize === "1080x1920" ? exportSize : "1080x1350"
  );
  const videoRef = useRef<HTMLVideoElement>(null);
  const loadVideoUrlsPromiseRef = useRef<Promise<{
    urls: string[];
    videoData: LayeredSlideInput[] | null;
    runId: string | null;
  }> | null>(null);
  const videoRenderRunIdRef = useRef<string | null>(null);
  const isStandalonePWA = useIsStandalonePWA();

  // Video no longer depends on export: we use render-for-video when slide URLs are needed.

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

  // Changing format or voice/caption settings invalidates the generated video; user must regenerate
  useEffect(() => {
    if (generatedVideoUrl) {
      setGeneratedVideoUrl(null);
      setGeneratedVideoBlob(null);
    }
  }, [videoSize, withVoiceover, withCaption, captionPosition, selectedVoiceId, voiceSpeed]);

  /** Clean up stored export files when user navigates away or after delay. */
  const cleanupExportStorageRef = useRef<{ exportId: string; timeoutId: ReturnType<typeof setTimeout> } | null>(null);

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    setDownloadUrl(null);
    setSlideUrls([]);
    setSlideVideoData(null);
    try {
      const res = await fetch(`/api/export/${carouselId}`, { method: "POST" });
      const contentType = res.headers.get("content-type") ?? "";
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Export failed");
        return;
      }
      if (contentType.includes("application/zip")) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "carousel.zip";
        a.click();
        URL.revokeObjectURL(url);
        router.refresh();

        const exportId = res.headers.get("X-Export-Id");
        if (exportId) {
          const cleanup = () => {
            fetch(`/api/export/${carouselId}/cleanup`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ exportId }),
            }).catch(() => {});
          };
          if (cleanupExportStorageRef.current?.timeoutId) {
            clearTimeout(cleanupExportStorageRef.current.timeoutId);
          }
          const EXPORT_CLEANUP_DELAY_MS = 60 * 60 * 1000;
          const timeoutId = setTimeout(() => {
            cleanup();
            onNavigateAway();
          }, EXPORT_CLEANUP_DELAY_MS);
          cleanupExportStorageRef.current = { exportId, timeoutId };
          const onNavigateAway = () => {
            cleanup();
            if (cleanupExportStorageRef.current?.timeoutId) {
              clearTimeout(cleanupExportStorageRef.current.timeoutId);
              cleanupExportStorageRef.current = null;
            }
            window.removeEventListener("beforeunload", onNavigateAway);
            window.removeEventListener("pagehide", onNavigateAway);
          };
          window.addEventListener("beforeunload", onNavigateAway);
          window.addEventListener("pagehide", onNavigateAway);
        }
      }
    } catch {
      setError("Export failed");
    } finally {
      setExporting(false);
    }
  };

  const loadVideoUrls = async (): Promise<{
    urls: string[];
    videoData: LayeredSlideInput[] | null;
    runId: string | null;
  }> => {
    const hasCompleteVideoData =
      slideVideoData != null &&
      slideVideoData.length === slideUrls.length &&
      slideVideoData.every((s) => s.backgroundUrls?.length);
    if (slideUrls.length > 0 && hasCompleteVideoData && videoRenderRunIdRef.current) {
      return { urls: slideUrls, videoData: slideVideoData, runId: videoRenderRunIdRef.current };
    }
    if (loadVideoUrlsPromiseRef.current) {
      return loadVideoUrlsPromiseRef.current;
    }
    const promise = (async () => {
      setVideoUrlsLoading(true);
      try {
        const res = await fetch(`/api/carousel/${carouselId}/render-for-video`, { method: "POST" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error ?? "Failed to prepare slides for video");
        }
        const runId = (data.runId as string) ?? null;
        if (runId) videoRenderRunIdRef.current = runId;
        if (data.slideUrls?.length) {
          setSlideUrls(data.slideUrls);
          const vd =
            Array.isArray(data.slideVideoData) && data.slideVideoData.length === data.slideUrls.length
              ? (data.slideVideoData as LayeredSlideInput[])
              : null;
          setSlideVideoData(vd);
          return { urls: data.slideUrls as string[], videoData: vd, runId };
        }
        return { urls: slideUrls.length > 0 ? slideUrls : [], videoData: null, runId };
      } finally {
        setVideoUrlsLoading(false);
        loadVideoUrlsPromiseRef.current = null;
      }
    })();
    loadVideoUrlsPromiseRef.current = promise;
    return promise;
  };

  const handleDownloadVideo = async () => {
    setVideoDownloading(true);
    setVideoDownloadError(null);
    setVideoDownloadProgress(0);
    setVideoDownloadStep("");
    try {
      const startRes = await fetch("/api/video-gen/start", { method: "POST" });
      if (startRes.status === 429) {
        const data = await startRes.json().catch(() => ({}));
        setVideoDownloadError(
          data.error ?? "Another video is being generated. Please wait and try again."
        );
        return;
      }
      if (!startRes.ok) {
        setVideoDownloadError("Could not start video generation. Try again.");
        return;
      }
    } catch {
      setVideoDownloadError("Could not start video generation. Try again.");
      return;
    }
    const { urls, videoData, runId } = await loadVideoUrls();
    if (urls.length === 0) {
      await fetch("/api/video-gen/end", { method: "POST" });
      setVideoDownloading(false);
      return;
    }
    const previousVideoUrl = generatedVideoUrl;
    try {
      const { width, height } = videoSizeToDimensions(videoSize);
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
                  voiceSpeed,
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
      await fetch("/api/video-gen/end", { method: "POST" });
      if (runId) {
        await fetch(`/api/carousel/${carouselId}/video-render/${runId}/cleanup`, { method: "POST" }).catch(() => {});
      }
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
                    width={videoSizeToDimensions(videoSize).width}
                    height={videoSizeToDimensions(videoSize).height}
                  />
                )}
              </div>
              <div className="flex flex-col items-center gap-4 mt-4">
                {/* Options row: only show before video is generated (or when Regenerate was clicked) */}
                {!generatedVideoUrl && (
                  <div
                    className={`flex flex-wrap items-center justify-center gap-4 w-full transition-opacity ${videoDownloading ? "pointer-events-none opacity-50" : ""}`}
                    aria-disabled={videoDownloading}
                  >
                    <div className="flex items-center gap-2">
                      <Label htmlFor="video-size" className="text-sm text-muted-foreground whitespace-nowrap">
                        Format
                      </Label>
                      <Select
                        value={videoSize}
                        onValueChange={(v) => setVideoSize(v as VideoSize)}
                        disabled={videoDownloading}
                      >
                        <SelectTrigger id="video-size" className="w-[100px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {VIDEO_SIZE_ORDER.map((size) => (
                            <SelectItem key={size} value={size}>
                              {VIDEO_SIZE_LABELS[size]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
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
                          <Label htmlFor="voice-speed" className="text-sm text-muted-foreground whitespace-nowrap">
                            Voice speed
                          </Label>
                          <Select
                            value={String(voiceSpeed)}
                            onValueChange={(v) => setVoiceSpeed(Number(v))}
                            disabled={videoDownloading}
                          >
                            <SelectTrigger id="voice-speed" className="w-[100px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0.75">0.75×</SelectItem>
                              <SelectItem value="1">1×</SelectItem>
                              <SelectItem value="1.25">1.25×</SelectItem>
                              <SelectItem value="1.5">1.5×</SelectItem>
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
                )}
                <div className={`flex items-center gap-2 flex-wrap justify-center ${videoDownloading ? "pointer-events-none opacity-50" : ""}`}>
                  {generatedVideoUrl ? (
                    <>
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
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setGeneratedVideoUrl(null);
                          setGeneratedVideoBlob(null);
                          setVideoDownloadError(null);
                          setCaptionPosition("safe_lower");
                        }}
                      >
                        <RefreshCwIcon className="mr-2 size-4" />
                        Regenerate
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      onClick={handleDownloadVideo}
                      disabled={videoDownloading}
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
                {generatedVideoUrl && enabledVideoPostPlatforms.length > 0 && (
                  <div className="flex flex-col items-center gap-2 w-full mt-2 pt-3 border-t border-border">
                    <p className="text-muted-foreground text-xs font-medium">Post video to</p>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      {enabledVideoPostPlatforms.map((key) => {
                        const connected = connectedSet.has(key);
                        if (key === "tiktok" && connected) {
                          return (
                            <PostToTiktokVideoButton
                              key={key}
                              carouselId={carouselId}
                              videoBlob={generatedVideoBlob}
                            />
                          );
                        }
                        if (key === "facebook" && connected) {
                          return (
                            <PostToFacebookVideoButton
                              key={key}
                              carouselId={carouselId}
                              videoBlob={generatedVideoBlob}
                            />
                          );
                        }
                        if (key === "instagram" && connected) {
                          return (
                            <PostToInstagramVideoButton
                              key={key}
                              carouselId={carouselId}
                              videoBlob={generatedVideoBlob}
                            />
                          );
                        }
                        if (key === "youtube" && connected) {
                          return (
                            <PostToYouTubeVideoButton
                              key={key}
                              carouselId={carouselId}
                              videoBlob={generatedVideoBlob}
                            />
                          );
                        }
                        const href = connected ? VIDEO_POST_URLS[key] ?? "#" : `/api/oauth/${key}/connect`;
                        const label = connected ? VIDEO_POST_LABELS[key] ?? key : `${VIDEO_POST_LABELS[key] ?? key} (Connect)`;
                        return (
                          <a
                            key={key}
                            href={href}
                            target={connected ? "_blank" : undefined}
                            rel={connected ? "noopener noreferrer" : undefined}
                            className="inline-flex items-center justify-center rounded-md border border-border bg-muted/50 px-2.5 py-1.5 text-foreground hover:bg-muted hover:border-primary/50 transition-colors"
                            title={label}
                          >
                            <PlatformIcon platform={key as "facebook" | "tiktok" | "instagram" | "linkedin" | "youtube"} className="size-3.5" />
                          </a>
                        );
                      })}
                    </div>
                    <p className="text-muted-foreground text-xs text-center">
                      {connectedSet.has("tiktok") || connectedSet.has("facebook") || connectedSet.has("instagram") || connectedSet.has("youtube")
                        ? "TikTok, Facebook, Instagram, and YouTube: post directly. LinkedIn: open in new tab, then upload the MP4."
                        : "Connect accounts in Settings to post directly. Or download the MP4 and upload on the platform."}
                    </p>
                  </div>
                )}
                {videoDownloadError && (
                  <p className="text-destructive text-xs">{videoDownloadError}</p>
                )}
                <p className="text-muted-foreground text-xs text-center">
                  {videoDownloading
                    ? "Keep this window open until the video finishes generating."
                    : generatedVideoUrl
                      ? "Download again if needed. Click Regenerate to change settings and create a new video."
                      : "Encodes in browser · Open this dialog first for faster download"}
                </p>
              </div>
            </DialogContent>
          </Dialog>
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
