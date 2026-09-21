import type { Json, PlatformConnection } from "@/lib/server/db/types";

/** One Instagram Business/Creator account linked to a Facebook Page (from OAuth). */
export type InstagramLinkedAccount = {
  igUserId: string;
  username: string | null;
  pageId: string;
  pageName: string | null;
  pageAccessToken: string;
};

function asObject(meta: Json): Record<string, Json | undefined> | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  return meta as Record<string, Json | undefined>;
}

function parseAccount(value: unknown): InstagramLinkedAccount | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.igUserId !== "string" || typeof row.pageId !== "string" || typeof row.pageAccessToken !== "string") {
    return null;
  }
  return {
    igUserId: row.igUserId,
    username: typeof row.username === "string" ? row.username : null,
    pageId: row.pageId,
    pageName: typeof row.pageName === "string" ? row.pageName : null,
    pageAccessToken: row.pageAccessToken,
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
      pageId: typeof meta?.page_id === "string" ? meta.page_id : "",
      pageName: typeof meta?.page_name === "string" ? meta.page_name : null,
      pageAccessToken: connection.access_token,
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
