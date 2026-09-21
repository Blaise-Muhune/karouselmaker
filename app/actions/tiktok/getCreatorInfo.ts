"use server";

import { getUser } from "@/lib/server/auth/getUser";
import { getPlatformConnection, upsertPlatformConnection } from "@/lib/server/db";
import {
  getTikTokCreatorInfo,
  refreshTikTokAccessToken,
  type TikTokCreatorInfo,
} from "@/lib/tiktok/postPhotos";

async function accessTokenForUser(userId: string): Promise<string | null> {
  const connection = await getPlatformConnection(userId, "tiktok");
  if (!connection) return null;
  const expiresAt = connection.expires_at ? new Date(connection.expires_at).getTime() : Number.POSITIVE_INFINITY;
  if (Number.isFinite(expiresAt) && expiresAt < Date.now() + 5 * 60_000) {
    if (!connection.refresh_token) return null;
    const refreshed = await refreshTikTokAccessToken(connection.refresh_token);
    await upsertPlatformConnection(userId, {
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

/** Loads current TikTok creator settings required before a compliant Direct Post. */
export async function getTikTokCreatorInfoAction(): Promise<
  { ok: true; creator: TikTokCreatorInfo } | { ok: false; error: string }
> {
  const { user } = await getUser();
  try {
    const accessToken = await accessTokenForUser(user.id);
    if (!accessToken) {
      return { ok: false, error: "Connect your TikTok account first." };
    }
    const creator = await getTikTokCreatorInfo(accessToken);
    return { ok: true, creator };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "TikTok creator settings could not be read.",
    };
  }
}
