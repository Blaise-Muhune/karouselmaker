import type { BrandKit } from "@/lib/renderer/renderModel";
import { getSignedImageUrl } from "@/lib/server/storage/signedImageUrl";

const BUCKET = "carousel-assets";

/**
 * Enrich brand kit with logo_url when logo_storage_path exists.
 */
export async function resolveBrandKitLogo(
  brandKit: BrandKit | Record<string, unknown> | null
): Promise<BrandKit> {
  const kit = (brandKit ?? {}) as BrandKit & { logo_storage_path?: string };
  const path = kit.logo_storage_path;
  if (!path?.trim()) return kit;

  try {
    const logoUrl = await getSignedImageUrl(BUCKET, path, 600);
    return { ...kit, logo_url: logoUrl };
  } catch {
    return kit;
  }
}
