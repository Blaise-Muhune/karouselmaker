/**
 * Instagram API with Instagram Login: users sign in on instagram.com directly.
 * No Facebook account or Page is required; the account must be Professional (Business or Creator).
 */

export const INSTAGRAM_LOGIN_SCOPES = "instagram_business_basic,instagram_business_content_publish";

const GRAPH = "https://graph.instagram.com";
/** Refresh long-lived tokens when they are within this window of expiring. */
const REFRESH_WINDOW_MS = 10 * 24 * 60 * 60 * 1000;

type InstagramError = {
  error?: { message?: string } | string;
  error_message?: string;
  error_description?: string;
};

function errorMessage(body: InstagramError, fallback: string): string {
  if (typeof body.error === "object" && body.error?.message) return body.error.message;
  return body.error_message || body.error_description || (typeof body.error === "string" ? body.error : fallback);
}

export function getInstagramLoginCredentials(): { appId: string; appSecret: string } | null {
  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  return appId && appSecret ? { appId, appSecret } : null;
}

export function buildInstagramAuthUrl(
  appId: string,
  redirectUri: string,
  state: string,
  options?: { forceReauth?: boolean }
): string {
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: INSTAGRAM_LOGIN_SCOPES,
    state,
  });
  // Without this, Instagram silently reuses the browser's logged-in account.
  if (options?.forceReauth) params.set("force_reauth", "true");
  return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
}

export type InstagramLoginResult = {
  accessToken: string;
  expiresAt: string | null;
  igUserId: string;
  username: string | null;
};

/** Code → short-lived token → long-lived token (60 days) → profile. */
export async function exchangeInstagramLoginCode(input: {
  code: string;
  redirectUri: string;
}): Promise<{ ok: true; result: InstagramLoginResult } | { ok: false; error: string }> {
  const creds = getInstagramLoginCredentials();
  if (!creds) return { ok: false, error: "Instagram is not configured." };

  const shortRes = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: creds.appId,
      client_secret: creds.appSecret,
      grant_type: "authorization_code",
      redirect_uri: input.redirectUri,
      code: input.code.replace(/#_$/, ""),
    }),
  });
  const shortBody = (await shortRes.json().catch(() => ({}))) as InstagramError & {
    access_token?: string;
    data?: Array<{ access_token?: string }>;
  };
  const shortToken = shortBody.access_token ?? shortBody.data?.[0]?.access_token;
  if (!shortRes.ok || !shortToken) {
    return { ok: false, error: errorMessage(shortBody, "Instagram did not return an access token.") };
  }

  const longParams = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: creds.appSecret,
    access_token: shortToken,
  });
  const longRes = await fetch(`${GRAPH}/access_token?${longParams.toString()}`);
  const longBody = (await longRes.json().catch(() => ({}))) as InstagramError & {
    access_token?: string;
    expires_in?: number;
  };
  if (!longRes.ok || !longBody.access_token) {
    return { ok: false, error: errorMessage(longBody, "Could not get a long-lived Instagram token.") };
  }
  const accessToken = longBody.access_token;
  const expiresAt = longBody.expires_in ? new Date(Date.now() + longBody.expires_in * 1000).toISOString() : null;

  const profileParams = new URLSearchParams({ fields: "user_id,username", access_token: accessToken });
  const profileRes = await fetch(`${GRAPH}/v21.0/me?${profileParams.toString()}`);
  const profile = (await profileRes.json().catch(() => ({}))) as InstagramError & {
    user_id?: string | number;
    id?: string;
    username?: string;
  };
  const igUserId = profile.user_id != null ? String(profile.user_id) : profile.id;
  if (!profileRes.ok || !igUserId) {
    return { ok: false, error: errorMessage(profile, "Could not read your Instagram profile.") };
  }

  return { ok: true, result: { accessToken, expiresAt, igUserId, username: profile.username ?? null } };
}

export function instagramTokenNeedsRefresh(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const ms = Date.parse(expiresAt);
  return Number.isFinite(ms) && ms - Date.now() < REFRESH_WINDOW_MS;
}

/** Extends a long-lived Instagram Login token by another 60 days. Returns null if Instagram refuses. */
export async function refreshInstagramLoginToken(
  accessToken: string
): Promise<{ accessToken: string; expiresAt: string | null } | null> {
  const params = new URLSearchParams({ grant_type: "ig_refresh_token", access_token: accessToken });
  const res = await fetch(`${GRAPH}/refresh_access_token?${params.toString()}`);
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
  if (!res.ok || !body.access_token) return null;
  return {
    accessToken: body.access_token,
    expiresAt: body.expires_in ? new Date(Date.now() + body.expires_in * 1000).toISOString() : null,
  };
}
