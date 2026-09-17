import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";
import { getAsset } from "@/lib/server/db/assets";
import { getSignedImageUrl } from "@/lib/server/storage/signedImageUrl";
import { httpsDisplayImageUrl } from "@/lib/server/storage/signedUrlUtils";

const BUCKET = "carousel-assets";
const MAX_PREVIEW_IMAGES = 4;

type BackgroundImageSlot = {
  image_url?: unknown;
  storage_path?: unknown;
  asset_id?: unknown;
  alternates?: unknown;
};

function storagePath(path: unknown): string | undefined {
  if (typeof path !== "string") return undefined;
  const trimmed = path.trim().replace(/^\/+/, "");
  if (!trimmed) return undefined;
  const prefix = `${BUCKET}/`;
  return trimmed.startsWith(prefix) ? trimmed.slice(prefix.length) : trimmed;
}

/**
 * Produces fresh, browser-safe preview URLs for images baked into a template.
 * Templates retain storage paths, rather than expiring signed URLs, so a user-uploaded
 * image stays visible in the picker after the page is refreshed.
 */
export async function resolveTemplatePreviewImageUrls(
  userId: string,
  config: TemplateConfig
): Promise<string[]> {
  const background = config.defaults?.background;
  if (!background || typeof background !== "object" || Array.isArray(background)) return [];

  const bg = background as BackgroundImageSlot & { mode?: unknown; images?: unknown };
  if (bg.mode !== "image") return [];

  const slots: BackgroundImageSlot[] = Array.isArray(bg.images) && bg.images.length > 0
    ? bg.images.filter((slot): slot is BackgroundImageSlot => !!slot && typeof slot === "object")
    : [bg];

  const urls = await Promise.all(
    slots.slice(0, MAX_PREVIEW_IMAGES).map(async (slot) => {
      let path = storagePath(slot.storage_path);
      if (!path && typeof slot.asset_id === "string" && slot.asset_id) {
        path = storagePath((await getAsset(userId, slot.asset_id))?.storage_path);
      }
      if (path) {
        try {
          return await getSignedImageUrl(BUCKET, path);
        } catch {
          // The URL below may still be a public stock source or an unexpired signed URL.
        }
      }

      const direct = httpsDisplayImageUrl(typeof slot.image_url === "string" ? slot.image_url : undefined);
      if (direct) return direct;
      if (Array.isArray(slot.alternates)) {
        return slot.alternates
          .map((url) => httpsDisplayImageUrl(typeof url === "string" ? url : undefined))
          .find((url): url is string => !!url);
      }
      return undefined;
    })
  );

  return urls.filter((url): url is string => !!url);
}
