"use client";

import { Player } from "@remotion/player";
import { CarouselVideo, CAROUSEL_VIDEO_FPS, SECONDS_PER_SLIDE } from "@/remotion/CarouselVideo";

type CarouselVideoPlayerProps = {
  slideUrls: string[];
  width?: number;
  height?: number;
  className?: string;
};

/**
 * In-browser video preview of a carousel using Remotion Player.
 * Plays slides in sequence with fade transitions.
 */
export function CarouselVideoPlayer({
  slideUrls,
  width = 1080,
  height = 1080,
  className,
}: CarouselVideoPlayerProps) {
  const durationInFrames = Math.max(1, slideUrls.length) * CAROUSEL_VIDEO_FPS * SECONDS_PER_SLIDE;

  if (slideUrls.length === 0) {
    return (
      <div className={`flex items-center justify-center rounded-lg border border-border/50 bg-muted/10 ${className ?? ""}`} style={{ minHeight: 300 }}>
        <p className="text-muted-foreground text-sm">Export your carousel to preview as video</p>
      </div>
    );
  }

  const scale = Math.min(1, 400 / width, 400 / height);

  return (
    <div className={className}>
      <Player
        component={CarouselVideo}
        inputProps={{ slideUrls, width, height }}
        durationInFrames={durationInFrames}
        compositionWidth={width}
        compositionHeight={height}
        fps={CAROUSEL_VIDEO_FPS}
        style={{
          width: width * scale,
          height: height * scale,
          maxWidth: "100%",
          borderRadius: 8,
          overflow: "hidden",
        }}
        controls
        loop
      />
    </div>
  );
}
