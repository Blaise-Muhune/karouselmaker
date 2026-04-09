import type { CarouselOutput } from "@/lib/server/ai/carouselSchema";

type Slide = CarouselOutput["slides"][number];

/**
 * Heuristic: first slide we treat as a good pixel anchor for UGC same-carousel face chaining.
 * Avoid anchoring on obvious UI/hands-only frames when the copy hints at that.
 */
export function ugcSlideLikelyShowsHostFaceForChainRef(slide: Slide): boolean {
  const queries =
    slide.image_queries?.filter((q) => q?.trim()) ??
    slide.unsplash_queries?.filter((q) => q?.trim()) ??
    (slide.image_query?.trim()
      ? [slide.image_query.trim()]
      : slide.unsplash_query?.trim()
        ? [slide.unsplash_query.trim()]
        : []);
  const text = [slide.headline ?? "", slide.body ?? "", ...queries].join(" ").toLowerCase();
  if (
    /\b(screenshot|slack|discord|message thread|email (draft|compose)|phone screen|ui only|interface only|hands on keyboard only|keyboard close-?up|laptop screen only|no face|overhead desk no person)\b/.test(
      text
    )
  ) {
    return false;
  }
  if (
    /\b(face|selfie|portrait|close-?up|creator|looking at camera|reaction|smiling at|talking to camera|webcam|mirror selfie|host)\b/.test(
      text
    )
  ) {
    return true;
  }
  if (slide.slide_index === 1) return true;
  return false;
}
