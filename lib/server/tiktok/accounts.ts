import { deletePlatformConnection, getPlatformConnection, upsertPlatformConnection } from "@/lib/server/db";
import type { PlatformConnection } from "@/lib/server/db/types";
import { getTikTokLinkedAccounts, resolveTikTokAccount, type TikTokLinkedAccount } from "@/lib/tiktok/accounts";
import { refreshTikTokAccessToken } from "@/lib/tiktok/postPhotos";

const TIKTOK_SCOPE = "user.info.basic,video.publish";

function metaObject(connection: PlatformConnection | null): Record<string, unknown> {
  const meta = connection?.meta;
  return meta && typeof meta === "object" && !Array.isArray(meta) ? (meta as Record<string, unknown>) : {};
}

/**
 * Persist the account list. The top-level token columns mirror `primary` so older readers keep working.
 * Deletes the connection when no accounts remain.
 */
export async function saveTikTokAccounts(
  userId: string,
  connection: PlatformConnection | null,
  accounts: TikTokLinkedAccount[],
  primaryOpenId: string | null
): Promise<void> {
  if (accounts.length === 0) {
    await deletePlatformConnection(userId, "tiktok");
    return;
  }
  const primary = accounts.find((a) => a.openId === primaryOpenId) ?? accounts[accounts.length - 1]!;
  await upsertPlatformConnection(userId, {
    platform: "tiktok",
    access_token: primary.accessToken,
    refresh_token: primary.refreshToken,
    expires_at: primary.expiresAt,
    scope: connection?.scope ?? TIKTOK_SCOPE,
    platform_user_id: primary.openId || null,
    platform_username: primary.username,
    meta: { ...metaObject(connection), direct_post: true, accounts },
  });
}

/** Adds or replaces an account after OAuth and makes it the connection default. */
export async function addTikTokAccount(userId: string, account: TikTokLinkedAccount): Promise<void> {
  const connection = await getPlatformConnection(userId, "tiktok");
  const others = connection
    ? getTikTokLinkedAccounts(connection).filter((a) => a.openId && a.openId !== account.openId)
    : [];
  await saveTikTokAccounts(userId, connection, [...others, account], account.openId);
}

/**
 * Valid access token for one account (project choice, schedule, or default), refreshing it when near expiry.
 * Returns null when no account is connected.
 */
export async function getTikTokAccessToken(
  userId: string,
  preferredOpenId: string | null | undefined
): Promise<{ accessToken: string; account: TikTokLinkedAccount } | null> {
  const connection = await getPlatformConnection(userId, "tiktok");
  if (!connection) return null;
  const account = resolveTikTokAccount(connection, preferredOpenId);
  if (!account) return null;

  const expiresAt = account.expiresAt ? new Date(account.expiresAt).getTime() : Number.POSITIVE_INFINITY;
  if (!Number.isFinite(expiresAt) || expiresAt >= Date.now() + 5 * 60_000) {
    return { accessToken: account.accessToken, account };
  }
  if (!account.refreshToken) throw new Error("TikTok connection expired. Reconnect the account.");

  const refreshed = await refreshTikTokAccessToken(account.refreshToken);
  const updated: TikTokLinkedAccount = {
    ...account,
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken ?? account.refreshToken,
    expiresAt: refreshed.expiresAt ?? account.expiresAt,
  };
  const accounts = getTikTokLinkedAccounts(connection).map((a) => (a.openId === account.openId ? updated : a));
  await saveTikTokAccounts(userId, connection, accounts, connection.platform_user_id);
  return { accessToken: updated.accessToken, account: updated };
}
