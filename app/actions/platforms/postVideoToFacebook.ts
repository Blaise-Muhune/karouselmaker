"use server";

import { getUser } from "@/lib/server/auth/getUser";
import { isAdmin } from "@/lib/server/auth/isAdmin";
import { getPlatformConnection } from "@/lib/server/db/platformConnections";
import { getCarousel } from "@/lib/server/db";
import { getSignedImageUrl } from "@/lib/server/storage/signedImageUrl";
import { getCaptionAndHashtagsForPost } from "@/lib/server/captionForPost";
import { postVideoToPage } from "@/lib/facebook/postToPage";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "carousel-assets";
const SIGNED_URL_EXPIRES = 600; // 10 min for Facebook to fetch video

export type PostVideoToFacebookResult =
  | { ok: true; post_url: string }
  | { ok: false; error: string };

export async function postVideoToFacebook(
  carouselId: string,
  videoStoragePath: string
): Promise<PostVideoToFacebookResult> {
  const { user } = await getUser();
  if (!isAdmin(user.email ?? null)) {
    return { ok: false, error: "Admins only." };
  }

  const connection = await getPlatformConnection(user.id, "facebook");
  if (!connection) {
    return { ok: false, error: "Connect Facebook in Settings → Connected accounts first." };
  }

  const meta = connection.meta as { page_id?: string; page_access_token?: string; no_page?: boolean } | null;
  const pageId = meta?.page_id;
  const pageToken = meta?.page_access_token;
  if (!pageId || !pageToken) {
    return {
      ok: false,
      error: "No Facebook Page linked. Reconnect Facebook in Settings → Connected accounts.",
    };
  }

  if (!videoStoragePath.startsWith(`user/${user.id}/facebook-video-uploads/${carouselId}/`)) {
    return { ok: false, error: "Invalid video path." };
  }

  const carousel = await getCarousel(user.id, carouselId);
  if (!carousel) {
    return { ok: false, error: "Carousel not found." };
  }

  let videoUrl: string;
  try {
    videoUrl = await getSignedImageUrl(BUCKET, videoStoragePath, SIGNED_URL_EXPIRES);
  } catch (e) {
    return { ok: false, error: "Could not get video URL. Upload the video again from the preview, then post." };
  }

  const description = getCaptionAndHashtagsForPost(carousel);

  try {
    const result = await postVideoToPage(pageId, pageToken, videoUrl, description || undefined);
    await createAdminClient().storage.from(BUCKET).remove([videoStoragePath]);
    return { ok: true, post_url: result.post_url };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    if (errMsg.toLowerCase().includes("access token") || errMsg.includes("190")) {
      return { ok: false, error: "Facebook access expired. Reconnect in Settings → Connected accounts." };
    }
    return { ok: false, error: errMsg || "Facebook video post failed." };
  }
}
