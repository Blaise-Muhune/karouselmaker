"use server";

import { getUser } from "@/lib/server/auth/getUser";
import { isAdmin } from "@/lib/server/auth/isAdmin";
import { getPlatformConnection } from "@/lib/server/db/platformConnections";
import { getCarousel, listExportsByCarousel, listSlides } from "@/lib/server/db";
import { getExportStoragePaths } from "@/lib/server/db/exports";
import { getSignedImageUrl } from "@/lib/server/storage/signedImageUrl";
import { postCarouselToInstagram } from "@/lib/instagram/postCarousel";

const BUCKET = "carousel-assets";
const SIGNED_URL_EXPIRES = 300; // 5 min for Instagram to fetch

export type PostToInstagramResult =
  | { ok: true; media_id: string; permalink?: string }
  | { ok: false; error: string };

export async function postToInstagram(
  carouselId: string,
  caption?: string
): Promise<PostToInstagramResult> {
  const { user } = await getUser();
  if (!isAdmin(user.email ?? null)) {
    return { ok: false, error: "Admins only." };
  }

  const connection = await getPlatformConnection(user.id, "instagram");
  if (!connection) {
    return { ok: false, error: "Connect Instagram in Settings → Connected accounts first." };
  }

  const meta = connection.meta as {
    ig_account_id?: string;
    page_access_token?: string;
    no_page?: boolean;
  } | null;
  const igAccountId = meta?.ig_account_id;
  const pageToken = meta?.page_access_token;
  if (!igAccountId || !pageToken) {
    return {
      ok: false,
      error:
        "No Instagram account linked. In Connected accounts, disconnect Instagram and reconnect with an account that has an Instagram Business or Creator account linked to a Facebook Page.",
    };
  }

  const carousel = await getCarousel(user.id, carouselId);
  if (!carousel) {
    return { ok: false, error: "Carousel not found." };
  }

  const exports = await listExportsByCarousel(user.id, carouselId, 1);
  const readyExport = exports.find((e) => e.status === "ready");
  if (!readyExport) {
    return { ok: false, error: "No export ready yet. Export this carousel first (Export section above)." };
  }

  const slides = await listSlides(user.id, carouselId);
  if (slides.length === 0) {
    return { ok: false, error: "Carousel has no slides." };
  }

  const paths = getExportStoragePaths(user.id, carouselId, readyExport.id);
  const imageUrls: string[] = [];
  try {
    for (let i = 0; i < slides.length; i++) {
      const url = await getSignedImageUrl(BUCKET, paths.slidePath(i), SIGNED_URL_EXPIRES);
      imageUrls.push(url);
    }
  } catch (e) {
    return { ok: false, error: "Could not get image URLs. Try re-exporting the carousel." };
  }

  try {
    const result = await postCarouselToInstagram(igAccountId, pageToken, imageUrls, caption);
    return {
      ok: true,
      media_id: result.media_id,
      permalink: result.permalink,
    };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    const friendly = friendlyInstagramError(errMsg);
    return { ok: false, error: friendly };
  }
}

function friendlyInstagramError(apiMessage: string): string {
  const lower = apiMessage.toLowerCase();
  if (lower.includes("access token") || lower.includes("token has expired") || lower.includes("190")) {
    return "Instagram access expired. Reconnect Instagram in Settings → Connected accounts.";
  }
  if (lower.includes("permission") || lower.includes("not authorized") || lower.includes("200")) {
    return "Your account doesn't have permission to post to this Instagram. Reconnect with an account that can publish (Settings → Connected accounts).";
  }
  if (lower.includes("invalid") || lower.includes("does not exist") || lower.includes("100")) {
    return "The linked Instagram account is invalid or was removed. Reconnect Instagram in Settings → Connected accounts.";
  }
  return apiMessage || "Instagram post failed. Try reconnecting in Settings → Connected accounts.";
}
