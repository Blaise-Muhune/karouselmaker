"use server";

import { getUser } from "@/lib/server/auth/getUser";
import { isAdmin } from "@/lib/server/auth/isAdmin";
import { getCarousel } from "@/lib/server/db";
import { getSignedImageUrl } from "@/lib/server/storage/signedImageUrl";
import { getCaptionAndHashtagsForPost } from "@/lib/server/captionForPost";
import { getValidYouTubeAccessToken } from "@/lib/youtube/getAccessToken";
import { uploadVideoToYouTube } from "@/lib/youtube/uploadVideo";

const BUCKET = "carousel-assets";
const SIGNED_URL_EXPIRES = 600;

export type PostVideoToYouTubeResult =
  | { ok: true; video_url: string }
  | { ok: false; error: string };

export async function postVideoToYouTube(
  carouselId: string,
  videoStoragePath: string
): Promise<PostVideoToYouTubeResult> {
  const { user } = await getUser();
  if (!isAdmin(user.email ?? null)) {
    return { ok: false, error: "Admins only." };
  }

  const token = await getValidYouTubeAccessToken(user.id);
  if (!token) {
    return { ok: false, error: "Connect YouTube in Settings → Connected accounts first." };
  }

  if (!videoStoragePath.startsWith(`user/${user.id}/youtube-video-uploads/${carouselId}/`)) {
    return { ok: false, error: "Invalid video path." };
  }

  const carousel = await getCarousel(user.id, carouselId);
  if (!carousel) {
    return { ok: false, error: "Carousel not found." };
  }

  let signedUrl: string;
  try {
    signedUrl = await getSignedImageUrl(BUCKET, videoStoragePath, SIGNED_URL_EXPIRES);
  } catch {
    return { ok: false, error: "Could not get video. Upload again from the preview, then post." };
  }

  const res = await fetch(signedUrl);
  if (!res.ok) {
    return { ok: false, error: "Could not read video file. Try again." };
  }
  const videoBytes = await res.arrayBuffer();

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
