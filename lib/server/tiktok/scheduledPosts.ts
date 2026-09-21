import { getExportStoragePaths } from "@/lib/server/db/exports";
import {
  attachTikTokPublishId,
  getPlatformConnection,
  markTikTokScheduledPostFailed,
  markTikTokScheduledPostPublished,
  upsertPlatformConnection,
} from "@/lib/server/db";
import type { TikTokScheduledPost } from "@/lib/server/db/types";
import {
  postPhotosToTikTok,
  refreshTikTokAccessToken,
  waitForTikTokPublishComplete,
} from "@/lib/tiktok/postPhotos";

/**
 * Public HTTPS origin TikTok pulls slide images from.
 * Uses NEXT_PUBLIC_APP_URL (must match a domain verified in TikTok URL properties).
 * Optional TIKTOK_VERIFIED_MEDIA_URL_PREFIX still wins if set, for rare overrides.
 */
export function getTikTokVerifiedMediaOrigin(): string | null {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  const override = process.env.TIKTOK_VERIFIED_MEDIA_URL_PREFIX?.trim().replace(/\/$/, "");
  const candidate = override || appUrl;
  if (!candidate) return null;
  try {
    const origin = new URL(candidate).origin;
    if (new URL(origin).protocol !== "https:") return null;
    // TikTok does not follow redirects. www → apex (or vercel.app auth walls) break photo pulls.
    const host = new URL(origin).hostname.toLowerCase();
    if (host.startsWith("www.")) return null;
    if (host.endsWith(".vercel.app")) return null;
    return origin;
  } catch {
    return null;
  }
}

function mediaUrls(schedule: TikTokScheduledPost): string[] {
  const origin = getTikTokVerifiedMediaOrigin();
  if (!origin) throw new Error("TikTok verified media URL is not configured.");
  // Path-based token (no ?query) — TikTok pull clients are more reliable with clean image URLs.
  return Array.from({ length: schedule.slide_count }, (_, index) => {
    return `${origin}/api/tiktok/m/${encodeURIComponent(schedule.media_token)}/${index}`;
  });
}

/** TikTok rejects redirected URLs and unsupported image formats before/during pull. */
async function assertMediaUrlsReachable(urls: string[]): Promise<void> {
  for (const url of urls) {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      headers: { Accept: "image/jpeg,image/webp,image/*,*/*;q=0.8" },
      signal: AbortSignal.timeout(20_000),
    });
    if (response.status >= 300 && response.status < 400) {
      throw new Error(
        "TikTok media URL redirected. Set NEXT_PUBLIC_APP_URL to the apex HTTPS domain (no www), then retry."
      );
    }
    if (!response.ok) {
      throw new Error(
        `TikTok media URL returned ${response.status}. Confirm the export finished and the verified domain can serve /api/tiktok/m/.`
      );
    }
    const contentType = (response.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
    if (contentType && !contentType.startsWith("image/jpeg") && contentType !== "image/webp" && contentType !== "image/jpg") {
      throw new Error(
        `TikTok only accepts JPEG or WebP photos (got ${contentType}). Export the schedule as JPEG and retry.`
      );
    }
    // Drain so the connection can close cleanly on serverless.
    await response.arrayBuffer();
  }
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

/** Executes a previously queued TikTok Photo Mode post. Called only by the protected cron route. */
export async function publishScheduledTikTokPost(schedule: TikTokScheduledPost): Promise<void> {
  try {
    const accessToken = await accessTokenForSchedule(schedule);
    let publishId = schedule.tiktok_publish_id;

    if (!publishId) {
      const photoUrls = mediaUrls(schedule);
      await assertMediaUrlsReachable(photoUrls);
      const result = await postPhotosToTikTok({
        accessToken,
        photoUrls,
        title: schedule.title,
        description: schedule.description,
        privacyLevel: schedule.privacy_level,
        allowComment: schedule.allow_comment === true,
        brandOrganic: schedule.brand_organic === true,
        brandContent: schedule.brand_content === true,
      });
      publishId = result.publishId;
      // Keep status as publishing so TikTok can still pull slide images.
      await attachTikTokPublishId(schedule.id, publishId);
    }

    const settled = await waitForTikTokPublishComplete({ accessToken, publishId });
    if (settled.status === "complete") {
      await markTikTokScheduledPostPublished(schedule.id, publishId);
      return;
    }
    if (settled.status === "failed") {
      await markTikTokScheduledPostFailed(schedule.id, settled.error);
      return;
    }
    // Still downloading. Leave publishing so the next cron tick can poll again.
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
