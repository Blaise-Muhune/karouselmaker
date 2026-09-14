import { getExportStoragePaths } from "@/lib/server/db/exports";
import {
  getPlatformConnection,
  markTikTokScheduledPostFailed,
  markTikTokScheduledPostPublished,
  upsertPlatformConnection,
} from "@/lib/server/db";
import type { TikTokScheduledPost } from "@/lib/server/db/types";
import { postPhotosToTikTok, refreshTikTokAccessToken } from "@/lib/tiktok/postPhotos";

export function getTikTokVerifiedMediaOrigin(): string | null {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  const verifiedPrefix = process.env.TIKTOK_VERIFIED_MEDIA_URL_PREFIX?.trim().replace(/\/$/, "");
  if (!appUrl || !verifiedPrefix) return null;
  try {
    const appOrigin = new URL(appUrl).origin;
    const verifiedOrigin = new URL(verifiedPrefix).origin;
    if (new URL(appOrigin).protocol !== "https:" || appOrigin !== verifiedOrigin) return null;
    return appOrigin;
  } catch {
    return null;
  }
}

function mediaUrls(schedule: TikTokScheduledPost): string[] {
  const origin = getTikTokVerifiedMediaOrigin();
  if (!origin) throw new Error("TikTok verified media URL is not configured.");
  return Array.from({ length: schedule.slide_count }, (_, index) => {
    const url = new URL(`/api/tiktok/scheduled-media/${schedule.id}/${index}`, origin);
    url.searchParams.set("token", schedule.media_token);
    return url.toString();
  });
}

async function accessTokenForSchedule(schedule: TikTokScheduledPost): Promise<string> {
  const connection = await getPlatformConnection(schedule.user_id, "tiktok");
  if (!connection) throw new Error("The TikTok account is no longer connected.");
  const expiresAt = connection.expires_at ? new Date(connection.expires_at).getTime() : Number.POSITIVE_INFINITY;
  if (Number.isFinite(expiresAt) && expiresAt < Date.now() + 5 * 60_000) {
    if (!connection.refresh_token) throw new Error("TikTok connection expired. Reconnect the account and schedule again.");
    const refreshed = await refreshTikTokAccessToken(connection.refresh_token);
    await upsertPlatformConnection(schedule.user_id, {
      platform: "tiktok",
      access_token: refreshed.accessToken,
      refresh_token: refreshed.refreshToken ?? connection.refresh_token,
      expires_at: refreshed.expiresAt ?? connection.expires_at,
      scope: connection.scope,
      platform_user_id: connection.platform_user_id,
      platform_username: connection.platform_username,
      meta: connection.meta,
    });
    return refreshed.accessToken;
  }
  return connection.access_token;
}

/** Executes a previously queued admin test post. Called only by the protected cron route. */
export async function publishScheduledTikTokPost(schedule: TikTokScheduledPost): Promise<void> {
  try {
    const accessToken = await accessTokenForSchedule(schedule);
    const result = await postPhotosToTikTok({
      accessToken,
      photoUrls: mediaUrls(schedule),
      title: schedule.title,
      description: schedule.description,
      privacyLevel: "SELF_ONLY",
    });
    await markTikTokScheduledPostPublished(schedule.id, result.publishId);
  } catch (error) {
    await markTikTokScheduledPostFailed(
      schedule.id,
      error instanceof Error ? error.message : "TikTok post failed."
    );
  }
}

/** Shared with the public media route so it serves the immutable export used by the schedule. */
export function scheduledPostSlidePath(schedule: TikTokScheduledPost, slideIndex: number): string | null {
  if (!Number.isInteger(slideIndex) || slideIndex < 0 || slideIndex >= schedule.slide_count) return null;
  return getExportStoragePaths(schedule.user_id, schedule.carousel_id, schedule.export_id).slidePath(slideIndex);
}
