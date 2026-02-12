import { Composition, Folder } from "remotion";
import { CarouselVideo, CAROUSEL_VIDEO_FPS, SECONDS_PER_SLIDE } from "./CarouselVideo";
import {
  PromoVideo,
  PROMO_DURATION_IN_FRAMES,
  PROMO_DURATION_SHORT_FRAMES,
  PROMO_FPS,
} from "./PromoVideo";

/**
 * Remotion root: registers compositions for rendering.
 * CarouselVideo: npx remotion render remotion/index.ts CarouselVideo out.mp4 --props='{"slideUrls":["https://..."]}'
 * Promo: npx remotion render remotion/index.ts PromoVideo promo.mp4
 */
export const RemotionRoot = () => (
  <>
    <Folder name="Marketing">
      <Composition
        id="PromoVideo"
        component={PromoVideo}
        durationInFrames={PROMO_DURATION_IN_FRAMES}
        fps={PROMO_FPS}
        width={1080}
        height={1080}
      />
      <Composition
        id="PromoVideoVertical"
        component={PromoVideo}
        durationInFrames={PROMO_DURATION_IN_FRAMES}
        fps={PROMO_FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="PromoVideoShort"
        component={PromoVideo}
        durationInFrames={PROMO_DURATION_SHORT_FRAMES}
        fps={PROMO_FPS}
        width={1080}
        height={1080}
        defaultProps={{ variant: "short" }}
      />
      <Composition
        id="PromoVideoShortVertical"
        component={PromoVideo}
        durationInFrames={PROMO_DURATION_SHORT_FRAMES}
        fps={PROMO_FPS}
        width={1080}
        height={1920}
        defaultProps={{ variant: "short" }}
      />
    </Folder>
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
