import type { Json, PlatformConnection } from "@/lib/server/db/types";

/** One TikTok account the user connected (stored in the TikTok connection's meta.accounts). */
export type TikTokLinkedAccount = {
  openId: string;
  username: string | null;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
};

export type TikTokAccountChoice = {
  openId: string;
  username: string | null;
};

function asObject(meta: Json): Record<string, Json | undefined> | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  return meta as Record<string, Json | undefined>;
}

function parseAccount(value: unknown): TikTokLinkedAccount | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.openId !== "string" || typeof row.accessToken !== "string") return null;
  return {
    openId: row.openId,
    username: typeof row.username === "string" ? row.username : null,
    accessToken: row.accessToken,
    refreshToken: typeof row.refreshToken === "string" ? row.refreshToken : null,
    expiresAt: typeof row.expiresAt === "string" ? row.expiresAt : null,
  };
}

/** All TikTok accounts on the connection; legacy single-account rows are read from the top-level columns. */
export function getTikTokLinkedAccounts(connection: PlatformConnection): TikTokLinkedAccount[] {
  const raw = asObject(connection.meta)?.accounts;
  if (Array.isArray(raw)) {
    const parsed = raw.map(parseAccount).filter((a): a is TikTokLinkedAccount => a != null);
    if (parsed.length > 0) return parsed;
  }
  if (!connection.access_token) return [];
  return [
    {
      openId: connection.platform_user_id ?? "",
      username: connection.platform_username,
      accessToken: connection.access_token,
      refreshToken: connection.refresh_token,
      expiresAt: connection.expires_at,
    },
  ];
}

/** Connection-level default (the most recently connected account). */
export function getDefaultTikTokAccount(connection: PlatformConnection): TikTokLinkedAccount | null {
  const accounts = getTikTokLinkedAccounts(connection);
  return accounts.find((a) => a.openId === connection.platform_user_id) ?? accounts[0] ?? null;
}

/** Account for a project: the project's saved choice if still connected, else the connection default. */
export function resolveTikTokAccount(
  connection: PlatformConnection,
  preferredOpenId: string | null | undefined
): TikTokLinkedAccount | null {
  if (preferredOpenId) {
    const match = getTikTokLinkedAccounts(connection).find((a) => a.openId === preferredOpenId);
    if (match) return match;
  }
  return getDefaultTikTokAccount(connection);
}

export function toTikTokAccountChoices(connection: PlatformConnection): TikTokAccountChoice[] {
  return getTikTokLinkedAccounts(connection).map((a) => ({ openId: a.openId, username: a.username }));
}
