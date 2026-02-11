import { Composition } from "remotion";
import { CarouselVideo, CAROUSEL_VIDEO_FPS, SECONDS_PER_SLIDE } from "./CarouselVideo";

/**
 * Remotion root: registers compositions for rendering.
 * Run: npx remotion render remotion/index.ts CarouselVideo out.mp4 --props='{"slideUrls":["https://...","https://..."]}'
 */
export const RemotionRoot = () => (
  <>
    <Composition
      id="CarouselVideo"
      component={CarouselVideo}
      durationInFrames={30 * SECONDS_PER_SLIDE * 10}
      fps={CAROUSEL_VIDEO_FPS}
      width={1080}
      height={1080}
      defaultProps={{
        slideUrls: [],
        width: 1080,
        height: 1080,
      }}
    />
    <Composition
      id="CarouselVideo1350"
      component={CarouselVideo}
      durationInFrames={30 * SECONDS_PER_SLIDE * 10}
      fps={CAROUSEL_VIDEO_FPS}
      width={1080}
      height={1350}
      defaultProps={{
        slideUrls: [],
        width: 1080,
        height: 1350,
      }}
    />
    <Composition
      id="CarouselVideo1920"
      component={CarouselVideo}
      durationInFrames={30 * SECONDS_PER_SLIDE * 10}
      fps={CAROUSEL_VIDEO_FPS}
      width={1080}
      height={1920}
      defaultProps={{
        slideUrls: [],
        width: 1080,
        height: 1920,
      }}
    />
  </>
);
