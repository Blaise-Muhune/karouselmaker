"use server";

import { getUser } from "@/lib/server/auth/getUser";
import { isAdmin } from "@/lib/server/auth/isAdmin";
import { getCarousel } from "@/lib/server/db";
import { getCaptionAndHashtagsForPost } from "@/lib/server/captionForPost";
import { getValidYouTubeAccessToken } from "@/lib/youtube/getAccessToken";
import { uploadVideoToYouTube } from "@/lib/youtube/uploadVideo";

export type PostVideoToYouTubeResult =
  | { ok: true; video_url: string }
  | { ok: false; error: string };

/** Post video (from FormData) to YouTube. No storage: client sends blob, we forward to YouTube. */
export async function postVideoToYouTube(
  carouselId: string,
  formData: FormData
): Promise<PostVideoToYouTubeResult> {
  const { user } = await getUser();
  if (!isAdmin(user.email ?? null)) {
    return { ok: false, error: "Admins only." };
  }

  const token = await getValidYouTubeAccessToken(user.id);
  if (!token) {
    return { ok: false, error: "Connect YouTube in Settings → Connected accounts first." };
  }

  const carousel = await getCarousel(user.id, carouselId);
  if (!carousel) {
    return { ok: false, error: "Carousel not found." };
  }

  const file = formData.get("video");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No video file. Generate the video and try again." };
  }
  const videoBytes = await file.arrayBuffer();

  const title = (carousel.title ?? "Untitled").slice(0, 100);
  const description = getCaptionAndHashtagsForPost(carousel) ?? "";

  try {
    const result = await uploadVideoToYouTube(token.access_token, videoBytes, {
      title,
      description,
      privacyStatus: "public",
    });
    return { ok: true, video_url: result.videoUrl };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    if (errMsg.toLowerCase().includes("token") || errMsg.includes("401") || errMsg.includes("403")) {
      return { ok: false, error: "YouTube access expired. Reconnect in Settings → Connected accounts." };
    }
    return { ok: false, error: errMsg || "YouTube upload failed." };
  }
}
