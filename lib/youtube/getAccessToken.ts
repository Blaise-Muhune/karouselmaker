"use server";

import { getPlatformConnection } from "@/lib/server/db/platformConnections";
import { upsertPlatformConnection } from "@/lib/server/db/platformConnections";

/**
 * Returns a valid YouTube access token for the user, refreshing if expired.
 * Updates the platform_connection row if a refresh was performed.
 */
export async function getValidYouTubeAccessToken(
  userId: string
): Promise<{ access_token: string } | null> {
  const connection = await getPlatformConnection(userId, "youtube");
  if (!connection?.access_token) return null;

  const expiresAt = connection.expires_at ? new Date(connection.expires_at).getTime() : 0;
  const now = Date.now();
  // Refresh if expired or within 5 minutes
  if (expiresAt > now + 5 * 60 * 1000) {
    return { access_token: connection.access_token };
  }

  const refreshToken = connection.refresh_token;
  if (!refreshToken) return null;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) return null;

  const newExpiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000).toISOString()
    : null;

  await upsertPlatformConnection(userId, {
    platform: "youtube",
    access_token: data.access_token,
    refresh_token: connection.refresh_token,
    expires_at: newExpiresAt,
    scope: connection.scope,
    platform_user_id: connection.platform_user_id,
    platform_username: connection.platform_username,
    meta: connection.meta,
  });

  return { access_token: data.access_token };
}
