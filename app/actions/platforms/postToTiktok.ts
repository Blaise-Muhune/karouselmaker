"use server";

import { getUser } from "@/lib/server/auth/getUser";
import { isAdmin } from "@/lib/server/auth/isAdmin";
import { getPlatformConnection } from "@/lib/server/db/platformConnections";
import { getCarousel } from "@/lib/server/db";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadVideoToTiktok } from "@/lib/tiktok/uploadVideo";

const BUCKET = "carousel-assets";

export type PostToTiktokResult =
  | { ok: true; publish_id: string; message: string }
  | { ok: false; error: string };

/**
 * Upload the video at the given storage path to the user's TikTok inbox via Content Posting API.
 * User will see it in TikTok app and can finish posting there.
 */
export async function postToTiktok(
  carouselId: string,
  videoStoragePath: string
): Promise<PostToTiktokResult> {
  const { user } = await getUser();
  if (!isAdmin(user.email ?? null)) {
    return { ok: false, error: "Admins only." };
  }

  const connection = await getPlatformConnection(user.id, "tiktok");
  if (!connection) {
    return { ok: false, error: "Connect TikTok in Settings → Connected accounts first." };
  }

  const carousel = await getCarousel(user.id, carouselId);
  if (!carousel) {
    return { ok: false, error: "Carousel not found." };
  }

  if (!videoStoragePath.startsWith(`user/${user.id}/tiktok-uploads/${carouselId}/`)) {
    return { ok: false, error: "Invalid video path." };
  }

  const supabase = createAdminClient();
  const { data: blob, error: downloadError } = await supabase.storage
    .from(BUCKET)
    .download(videoStoragePath);

  if (downloadError || !blob) {
    return { ok: false, error: "Could not read video. Upload it again from the video preview, then Post to TikTok." };
  }

  const buffer = Buffer.from(await blob.arrayBuffer());
  const accessToken = connection.access_token;

  try {
    const result = await uploadVideoToTiktok(accessToken, buffer);
    if (result.ok) {
      return {
        ok: true,
        publish_id: result.publish_id,
        message: "Video sent to your TikTok inbox. Open the TikTok app to finish posting.",
      };
    }
    return { ok: false, error: result.error };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.toLowerCase().includes("access_token") || msg.toLowerCase().includes("401")) {
      return { ok: false, error: "TikTok access expired. Reconnect TikTok in Settings → Connected accounts." };
    }
    if (msg.toLowerCase().includes("rate_limit") || msg.toLowerCase().includes("429")) {
      return { ok: false, error: "TikTok rate limit. Try again in a minute." };
    }
    return { ok: false, error: msg || "TikTok upload failed." };
  }
}
