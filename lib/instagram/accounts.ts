import type { Json, PlatformConnection } from "@/lib/server/db/types";

/**
 * "instagram": Instagram API with Instagram Login (graph.instagram.com, no Facebook Page).
 * "facebook": legacy Facebook Login + Page-linked IG account (graph.facebook.com).
 */
export type InstagramLoginType = "instagram" | "facebook";

/** One Instagram Business/Creator account the user connected. */
export type InstagramLinkedAccount = {
  igUserId: string;
  username: string | null;
  loginType: InstagramLoginType;
  accessToken: string;
  /** ISO timestamp; Instagram Login tokens are long-lived (60 days) and refreshed before posting. */
  expiresAt: string | null;
  pageId: string | null;
  pageName: string | null;
};

const GRAPH_BASES: Record<InstagramLoginType, string> = {
  instagram: "https://graph.instagram.com/v21.0",
  facebook: "https://graph.facebook.com/v21.0",
};

export function getInstagramGraphBase(loginType: InstagramLoginType): string {
  return GRAPH_BASES[loginType];
}

function asObject(meta: Json): Record<string, Json | undefined> | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  return meta as Record<string, Json | undefined>;
}

function parseAccount(value: unknown): InstagramLinkedAccount | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const accessToken =
    typeof row.accessToken === "string"
      ? row.accessToken
      : typeof row.pageAccessToken === "string"
        ? row.pageAccessToken
        : null;
  if (typeof row.igUserId !== "string" || !accessToken) return null;
  return {
    igUserId: row.igUserId,
    username: typeof row.username === "string" ? row.username : null,
    loginType: row.loginType === "instagram" ? "instagram" : "facebook",
    accessToken,
    expiresAt: typeof row.expiresAt === "string" ? row.expiresAt : null,
    pageId: typeof row.pageId === "string" && row.pageId ? row.pageId : null,
    pageName: typeof row.pageName === "string" ? row.pageName : null,
  };
}

/** All IG accounts stored on the Instagram platform connection. */
export function getInstagramLinkedAccounts(connection: PlatformConnection): InstagramLinkedAccount[] {
  const meta = asObject(connection.meta);
  const raw = meta?.accounts;
  if (Array.isArray(raw)) {
    const parsed = raw.map(parseAccount).filter((a): a is InstagramLinkedAccount => a != null);
    if (parsed.length > 0) return parsed;
  }

  // Legacy single-account connections.
  const igUserId =
    connection.platform_user_id ||
    (typeof meta?.ig_user_id === "string" ? meta.ig_user_id : null);
  if (!igUserId) return [];
  return [
    {
      igUserId,
      username: connection.platform_username,
      loginType: "facebook",
      accessToken: connection.access_token,
      expiresAt: connection.expires_at,
      pageId: typeof meta?.page_id === "string" && meta.page_id ? meta.page_id : null,
      pageName: typeof meta?.page_name === "string" ? meta.page_name : null,
    },
  ];
}

export function getSelectedInstagramAccount(connection: PlatformConnection): InstagramLinkedAccount | null {
  const accounts = getInstagramLinkedAccounts(connection);
  if (accounts.length === 0) return null;
  const meta = asObject(connection.meta);
  const selectedId =
    (typeof meta?.selected_ig_user_id === "string" ? meta.selected_ig_user_id : null) ||
    connection.platform_user_id;
  return accounts.find((a) => a.igUserId === selectedId) ?? accounts[0] ?? null;
}

export type InstagramAccountOption = {
  igUserId: string;
  username: string | null;
  pageName: string | null;
};
