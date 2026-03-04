"use server";

import { getUser } from "@/lib/server/auth/getUser";
import { isAdmin } from "@/lib/server/auth/isAdmin";
import { getPlatformConnection } from "@/lib/server/db/platformConnections";
import { getCarousel, listExportsByCarousel, listSlides } from "@/lib/server/db";
import { getExportStoragePaths } from "@/lib/server/db/exports";
import { getSignedImageUrl } from "@/lib/server/storage/signedImageUrl";
import { postMultiPhotoToPage } from "@/lib/facebook/postToPage";

const BUCKET = "carousel-assets";
const SIGNED_URL_EXPIRES = 300; // 5 min for Facebook to fetch

export type PostToFacebookResult =
  | { ok: true; post_id: string; post_url: string }
  | { ok: false; error: string };

export async function postToFacebook(carouselId: string, message?: string): Promise<PostToFacebookResult> {
  const { user } = await getUser();
  if (!isAdmin(user.email ?? null)) {
    return { ok: false, error: "Admins only." };
  }

  const connection = await getPlatformConnection(user.id, "facebook");
  if (!connection) {
    return { ok: false, error: "Connect Facebook in Settings → Connected accounts first." };
  }

  const meta = connection.meta as { page_id?: string; page_name?: string; page_access_token?: string; no_page?: boolean } | null;
  const pageId = meta?.page_id;
  const pageToken = meta?.page_access_token;
  if (!pageId || !pageToken) {
    return {
      ok: false,
      error: "No Facebook Page linked. Your account may not be an admin of a Page. In Connected accounts, disconnect Facebook and reconnect with an account that is an admin of a Facebook Page.",
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
    const result = await postMultiPhotoToPage(pageId, pageToken, imageUrls, message);
    return { ok: true, post_id: result.post_id, post_url: result.post_url };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    const friendly = friendlyFacebookError(errMsg);
    return { ok: false, error: friendly };
  }
}

function friendlyFacebookError(apiMessage: string): string {
  const lower = apiMessage.toLowerCase();
  if (lower.includes("(#200)") || lower.includes("has not authorized") || lower.includes("permission") || lower.includes("not authorized")) {
    return "Your Facebook account doesn’t have permission to post to this Page. Reconnect with an account that is an admin of the Page (Settings → Connected accounts).";
  }
  if (lower.includes("(#190)") || lower.includes("access token") || lower.includes("token has expired")) {
    return "Facebook access expired. Reconnect Facebook in Settings → Connected accounts.";
  }
  if (lower.includes("(#100)") || lower.includes("invalid") || lower.includes("does not exist")) {
    return "The linked Facebook Page is invalid or was removed. Reconnect Facebook in Settings → Connected accounts.";
  }
  return apiMessage || "Facebook post failed. Try reconnecting in Settings → Connected accounts.";
}
