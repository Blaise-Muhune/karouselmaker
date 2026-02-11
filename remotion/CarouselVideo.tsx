import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

export const CAROUSEL_VIDEO_FPS = 30;
export const SECONDS_PER_SLIDE = 4;
export const FRAMES_PER_SLIDE = CAROUSEL_VIDEO_FPS * SECONDS_PER_SLIDE;
export const FADE_DURATION_FRAMES = 20;

export type CarouselVideoProps = {
  slideUrls: string[];
  width: number;
  height: number;
};

/**
 * Remotion composition: carousel slides as a video sequence with crossfade transitions.
 * Each slide is shown for SECONDS_PER_SLIDE. During transitions, current and next overlap (crossfade).
 */
export function CarouselVideo({ slideUrls, width, height }: CarouselVideoProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const framesPerSlide = fps * SECONDS_PER_SLIDE;
  const currentIndex = Math.min(
    Math.floor(frame / framesPerSlide),
    Math.max(0, slideUrls.length - 1)
  );
  const frameInSlide = frame % framesPerSlide;
  const hasNext = currentIndex < slideUrls.length - 1;

  // Current slide: full opacity in middle, fade out at end (crossfade with next)
  // Only fade in at the very start for the first slide; slides after crossfade stay at 1
  const isFirstSlideAtStart = currentIndex === 0 && frame < FADE_DURATION_FRAMES;
  const currentOpacity = isFirstSlideAtStart
    ? interpolate(frameInSlide, [0, FADE_DURATION_FRAMES], [0, 1], {
        extrapolateRight: "clamp",
        extrapolateLeft: "clamp",
      })
    : interpolate(
        frameInSlide,
        [0, framesPerSlide - FADE_DURATION_FRAMES, framesPerSlide],
        [1, 1, 0],
        { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
      );

  // Next slide: only during last FADE_DURATION_FRAMES, fade in (true crossfade)
  const nextOpacity = hasNext
    ? interpolate(
        frameInSlide,
        [
          framesPerSlide - FADE_DURATION_FRAMES,
          framesPerSlide,
        ],
        [0, 1],
        { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
      )
    : 0;

  const currentUrl = slideUrls[currentIndex];
  const nextUrl = hasNext ? slideUrls[currentIndex + 1] : null;

  if (!currentUrl) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: "#0a0a0a",
          justifyContent: "center",
          alignItems: "center",
          color: "white",
          fontSize: 24,
        }}
      >
        No slides
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#000",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Img
        src={currentUrl}
        style={{
          position: "absolute",
          width,
          height,
          objectFit: "contain",
          opacity: currentOpacity,
        }}
      />
      {nextUrl && nextOpacity > 0 && (
        <Img
          src={nextUrl}
          style={{
            position: "absolute",
            width,
            height,
            objectFit: "contain",
            opacity: nextOpacity,
          }}
        />
      )}
    </AbsoluteFill>
  );
}
