"use client";

import { useState, useEffect, useRef } from "react";
import { SECONDS_PER_SLIDE } from "@/lib/video/createVideoFromImages";
import type { LayeredSlideInput } from "@/lib/video/createVideoFromImages";

const TICK_MS = 150;
const MAX_BACKGROUNDS_PER_SLIDE = 5;

/** Track which background URLs failed to load so we can show the first image instead of white. */
function useFailedBgUrls() {
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const add = (url: string) => setFailed((s) => (s.has(url) ? s : new Set(s).add(url)));
  return { failed, add };
}

type CarouselVideoPlayerProps = {
  slideUrls: string[];
  /** When set, preview shows up to 5 backgrounds cycling per slide with overlay on top (matches MP4). */
  slideVideoData?: LayeredSlideInput[] | null;
  width?: number;
  height?: number;
  className?: string;
};

/**
 * Video-style preview: either layered (backgrounds cycle + overlay per slide) or simple slideshow.
 * Layered mode matches the exported MP4: up to 5 images per slide play in the background, overlay stays on top, then transition to next slide.
 */
export function CarouselVideoPlayer({
  slideUrls,
  slideVideoData,
  width = 1080,
  height = 1080,
  className,
}: CarouselVideoPlayerProps) {
  const [index, setIndex] = useState(0);
  const [bgIndex, setBgIndex] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef<number>(Date.now());
  const { failed: failedBgUrls, add: markBgFailed } = useFailedBgUrls();

  const useLayered =
    Array.isArray(slideVideoData) &&
    slideVideoData.length === slideUrls.length &&
    slideVideoData.every((s) => s.backgroundUrls?.length >= 1);

  const n = slideUrls.length;
  const K = useLayered
    ? slideVideoData!.map((s) => Math.min(Math.max(1, s.backgroundUrls.length), MAX_BACKGROUNDS_PER_SLIDE))
    : null;
  // Layered mode: drive time so we can derive slide + background index
  useEffect(() => {
    if (!useLayered || n === 0) return;
    startRef.current = Date.now();
    setElapsedSec(0);
    const tick = () => {
      const elapsed = (Date.now() - startRef.current) / 1000;
      const totalDuration = n * SECONDS_PER_SLIDE;
      const looped = elapsed % totalDuration;
      setElapsedSec(looped);
    };
    intervalRef.current = setInterval(tick, TICK_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [useLayered, n]);

  // Simple mode: advance slide every SECONDS_PER_SLIDE
  useEffect(() => {
    if (useLayered || slideUrls.length === 0) return;
    const intervalMs = SECONDS_PER_SLIDE * 1000;
    intervalRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % slideUrls.length);
    }, intervalMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [useLayered, slideUrls.length]);

  // Derive slide and bg index from elapsed (layered mode)
  useEffect(() => {
    if (!useLayered || !K || K.length === 0) return;
    const slideIdx = Math.min(Math.floor(elapsedSec / SECONDS_PER_SLIDE), n - 1);
    const withinSlide = elapsedSec % SECONDS_PER_SLIDE;
    const k = K[slideIdx] ?? 1;
    const bgIdx = Math.min(Math.floor(withinSlide / (SECONDS_PER_SLIDE / k)), k - 1);
    setIndex(slideIdx);
    setBgIndex(bgIdx);
  }, [useLayered, elapsedSec, K, n]);

  if (slideUrls.length === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-border/50 bg-muted/10 ${className ?? ""}`}
        style={{ minHeight: 300 }}
      >
        <p className="text-muted-foreground text-sm">Export your carousel to preview as video</p>
      </div>
    );
  }

  const scale = Math.min(1, 400 / width, 400 / height);
  const displayWidth = width * scale;
  const displayHeight = height * scale;

  if (useLayered && slideVideoData) {
    const slide = slideVideoData[index]!;
    const urls = slide.backgroundUrls;
    const requestedUrl = urls[bgIndex % urls.length] ?? urls[0]!;
    const bgUrl = failedBgUrls.has(requestedUrl) && urls[0] ? urls[0] : requestedUrl;
    const overlayUrl = slide.overlayUrl ?? null;

    return (
      <div
        className={`overflow-hidden rounded-lg bg-black ${className ?? ""}`}
        style={{
          width: displayWidth,
          height: displayHeight,
          maxWidth: "100%",
          position: "relative",
        }}
      >
        {/* Background layer: current of up to 5 images; fallback to first if load fails */}
        <img
          key={`${index}-${bgIndex}`}
          src={bgUrl}
          alt=""
          role="presentation"
          className="absolute inset-0 h-full w-full object-cover animate-in fade-in duration-300"
          style={{ objectFit: "cover" }}
          onError={() => markBgFailed(requestedUrl)}
        />
        {/* Overlay layer: text/chrome (same for whole slide) */}
        {overlayUrl && (
          <img
            key={`overlay-${index}`}
            src={overlayUrl}
            alt=""
            role="presentation"
            className="absolute inset-0 h-full w-full object-cover pointer-events-none"
            style={{ objectFit: "cover", mixBlendMode: "normal" }}
          />
        )}
      </div>
    );
  }

  // Simple slideshow
  return (
    <div
      className={`overflow-hidden rounded-lg bg-black ${className ?? ""}`}
      style={{
        width: displayWidth,
        height: displayHeight,
        maxWidth: "100%",
        position: "relative",
      }}
    >
      <img
        key={index}
        src={slideUrls[index]}
        alt=""
        role="presentation"
        className="h-full w-full object-cover animate-in fade-in duration-300"
        style={{ objectFit: "cover" }}
      />
    </div>
  );
}
