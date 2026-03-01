import { getSignedImageUrl } from "@/lib/server/storage/signedImageUrl";

const BUCKET = "carousel-assets";

const MAX_VIDEO_BACKGROUNDS = 5;

/** Accepts DB slides (background may be Json); we read the shape we need. */
type SlideWithBackground = {
  background?: unknown;
};

type ImageSlot = {
  image_url?: string;
  storage_path?: string;
  alternates?: string[];
};

/**
 * Resolve background image URLs per slide for video.
 * - 1 slot: use primary + alternates (shuffle) → max 5 URLs.
 * - 2+ slots: use 1 image per slot, cap at 5 URLs.
 */
export async function resolveSlideBackgroundUrls(
  slides: SlideWithBackground[]
): Promise<{ backgroundUrls: string[] }[]> {
  const result: { backgroundUrls: string[] }[] = [];
  for (const slide of slides) {
    const slideBg = slide.background as {
      mode?: string;
      images?: ImageSlot[];
      image_url?: string;
      storage_path?: string;
    } | null | undefined;
    const urls: string[] = [];
    if (slideBg?.mode === "image") {
      if (slideBg.images?.length) {
        const slots = slideBg.images;
        if (slots.length === 1) {
          // One slot: primary + alternates (shuffle) → up to 5 for video
          const slot = slots[0]!;
          const primary = slot.image_url
            ? slot.image_url
            : slot.storage_path
              ? await getSignedImageUrl(BUCKET, slot.storage_path, 600).catch(() => null)
              : null;
          if (primary) {
            urls.push(primary);
            const alts = (slot.alternates ?? [])
              .filter((u) => typeof u === "string" && u.trim() && /^https?:\/\//i.test(u.trim()));
            for (let i = 0; i < alts.length && urls.length < MAX_VIDEO_BACKGROUNDS; i++) {
              urls.push(alts[i]!.trim());
            }
          }
        } else {
          // 2+ slots: 1 from each slot, cap at 5
          for (let i = 0; i < slots.length && urls.length < MAX_VIDEO_BACKGROUNDS; i++) {
            const img = slots[i]!;
            if (img.image_url) urls.push(img.image_url);
            else if (img.storage_path) {
              try {
                urls.push(await getSignedImageUrl(BUCKET, img.storage_path, 600));
              } catch {
                // skip
              }
            }
          }
        }
      } else if (slideBg.image_url) {
        urls.push(slideBg.image_url);
      } else if (slideBg.storage_path) {
        try {
          urls.push(await getSignedImageUrl(BUCKET, slideBg.storage_path, 600));
        } catch {
          // skip
        }
      }
    }
    result.push({ backgroundUrls: urls.length > 0 ? urls : [] });
  }
  return result;
}
