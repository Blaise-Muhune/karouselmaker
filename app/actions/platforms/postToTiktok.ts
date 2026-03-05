"use server";

import { getUser } from "@/lib/server/auth/getUser";
import { isAdmin } from "@/lib/server/auth/isAdmin";
import { getPlatformConnection } from "@/lib/server/db/platformConnections";
import { getCarousel } from "@/lib/server/db";
import { uploadVideoToTiktok } from "@/lib/tiktok/uploadVideo";

export type PostToTiktokResult =
  | { ok: true; publish_id: string; message: string }
  | { ok: false; error: string };

/**
 * Post the video (from FormData) to the user's TikTok inbox. No storage: client sends blob, we forward to TikTok.
 */
export async function postToTiktok(
  carouselId: string,
  formData: FormData
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

  const file = formData.get("video");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No video file. Generate the video and try again." };
  }
  const buffer = Buffer.from(await file.arrayBuffer());
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
