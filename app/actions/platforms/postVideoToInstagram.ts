"use server";

import { getUser } from "@/lib/server/auth/getUser";
import { isAdmin } from "@/lib/server/auth/isAdmin";
import { getPlatformConnection } from "@/lib/server/db/platformConnections";
import { getCarousel } from "@/lib/server/db";
import { getSignedImageUrl } from "@/lib/server/storage/signedImageUrl";
import { getCaptionAndHashtagsForPost } from "@/lib/server/captionForPost";
import { postReelToInstagram } from "@/lib/instagram/postReel";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "carousel-assets";
const SIGNED_URL_EXPIRES = 600; // 10 min for Instagram to fetch video

export type PostVideoToInstagramResult =
  | { ok: true; permalink?: string }
  | { ok: false; error: string };

export async function postVideoToInstagram(
  carouselId: string,
  videoStoragePath: string
): Promise<PostVideoToInstagramResult> {
  const { user } = await getUser();
  if (!isAdmin(user.email ?? null)) {
    return { ok: false, error: "Admins only." };
  }

  const connection = await getPlatformConnection(user.id, "instagram");
  if (!connection) {
    return { ok: false, error: "Connect Instagram in Settings → Connected accounts first." };
  }

  const meta = connection.meta as { ig_account_id?: string; page_access_token?: string } | null;
  const igAccountId = meta?.ig_account_id;
  const pageToken = meta?.page_access_token;
  if (!igAccountId || !pageToken) {
    return {
      ok: false,
      error: "No Instagram account linked. Reconnect Instagram in Settings → Connected accounts.",
    };
  }

  if (!videoStoragePath.startsWith(`user/${user.id}/instagram-video-uploads/${carouselId}/`)) {
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

  const caption = getCaptionAndHashtagsForPost(carousel);

  try {
    const result = await postReelToInstagram(igAccountId, pageToken, videoUrl, caption || undefined);
    await createAdminClient().storage.from(BUCKET).remove([videoStoragePath]);
    return { ok: true, permalink: result.permalink };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    if (errMsg.toLowerCase().includes("access token") || errMsg.includes("190")) {
      return { ok: false, error: "Instagram access expired. Reconnect in Settings → Connected accounts." };
    }
    return { ok: false, error: errMsg || "Instagram video post failed." };
  }
}
