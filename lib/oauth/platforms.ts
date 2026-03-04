import type { PlatformName } from "@/lib/server/db/types";

const BASE = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

export function getRedirectUri(platform: PlatformName): string {
  return `${BASE}/api/oauth/${platform}/callback`;
}

export function getAuthUrl(platform: PlatformName, state: string): string | null {
  const redirectUri = encodeURIComponent(getRedirectUri(platform));
  switch (platform) {
    case "facebook": {
      const clientId = process.env.FACEBOOK_APP_ID;
      if (!clientId) return null;
      // Minimal valid scopes for Facebook Login: list Pages and post to Page.
      // pages_read_engagement, instagram_basic, instagram_content_publish, publish_to_groups can trigger "Invalid Scopes" depending on app type.
      // Add more in App Dashboard → App Review if needed; request only what your app uses.
      const scope = encodeURIComponent("pages_show_list,pages_manage_posts");
      return `https://www.facebook.com/v21.0/dialog/oauth?client_id=${clientId}&redirect_uri=${redirectUri}&state=${encodeURIComponent(state)}&scope=${scope}&response_type=code`;
    }
    case "tiktok": {
      const clientKey = process.env.TIKTOK_CLIENT_KEY;
      if (!clientKey) return null;
      const scope = encodeURIComponent("user.info.basic,video.upload");
      return `https://www.tiktok.com/v2/auth/authorize/?client_key=${clientKey}&scope=${scope}&response_type=code&redirect_uri=${redirectUri}&state=${encodeURIComponent(state)}`;
    }
    case "instagram": {
      // Same Meta app; request Instagram + Page scopes so we can list IG Business accounts linked to Pages
      const clientId = process.env.FACEBOOK_APP_ID;
      if (!clientId) return null;
      const scope = encodeURIComponent(
        "pages_show_list,pages_read_engagement,instagram_basic,instagram_content_publish"
      );
      return `https://www.facebook.com/v21.0/dialog/oauth?client_id=${clientId}&redirect_uri=${redirectUri}&state=${encodeURIComponent(state)}&scope=${scope}&response_type=code`;
    }
    case "linkedin": {
      const clientId = process.env.LINKEDIN_CLIENT_ID;
      if (!clientId) return null;
      const scope = encodeURIComponent("openid profile email w_member_social");
      return `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&state=${encodeURIComponent(state)}&scope=${scope}`;
    }
    case "youtube": {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      if (!clientId) return null;
      const scope = encodeURIComponent("https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/userinfo.email");
      return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${encodeURIComponent(state)}&access_type=offline&prompt=consent`;
    }
    default:
      return null;
  }
}

export async function exchangeCode(
  platform: PlatformName,
  code: string
): Promise<{ access_token: string; refresh_token?: string; expires_at?: string; platform_user_id?: string; platform_username?: string } | null> {
  const redirectUri = getRedirectUri(platform);
  switch (platform) {
    case "facebook": {
      const clientId = process.env.FACEBOOK_APP_ID;
      const clientSecret = process.env.FACEBOOK_APP_SECRET;
      if (!clientId || !clientSecret) return null;
      const url = `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${clientSecret}&code=${encodeURIComponent(code)}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = (await res.json()) as { access_token?: string; expires_in?: number };
      if (!data.access_token) return null;
      const expiresAt = data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : undefined;
      return { access_token: data.access_token, expires_at: expiresAt };
    }
    case "tiktok": {
      const clientKey = process.env.TIKTOK_CLIENT_KEY;
      const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
      if (!clientKey || !clientSecret) return null;
      const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_key: clientKey,
          client_secret: clientSecret,
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }),
      });
      const data = (await res.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        error?: string;
        error_description?: string;
      };
      if (!res.ok || data.error || !data.access_token) return null;
      const expiresAt = data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : undefined;
      let platform_user_id: string | undefined;
      let platform_username: string | undefined;
      const userRes = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name", {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      if (userRes.ok) {
        const userData = (await userRes.json()) as { data?: { user?: { open_id?: string; display_name?: string } } };
        const user = userData.data?.user;
        if (user) {
          platform_user_id = user.open_id;
          platform_username = user.display_name ?? undefined;
        }
      }
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: expiresAt,
        platform_user_id,
        platform_username,
      };
    }
    case "linkedin": {
      const clientId = process.env.LINKEDIN_CLIENT_ID;
      const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
      if (!clientId || !clientSecret) return null;
      const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { access_token?: string; expires_in?: number; refresh_token?: string };
      if (!data.access_token) return null;
      const expiresAt = data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : undefined;
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: expiresAt,
      };
    }
    case "youtube": {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      if (!clientId || !clientSecret) return null;
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
      if (!data.access_token) return null;
      const expiresAt = data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : undefined;
      let platform_username: string | undefined;
      const channelRes = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      if (channelRes.ok) {
        const channelData = (await channelRes.json()) as {
          items?: Array<{ id?: string; snippet?: { title?: string } }>;
        };
        const channel = channelData.items?.[0];
        if (channel?.snippet?.title) {
          platform_username = channel.snippet.title;
        }
      }
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: expiresAt,
        platform_user_id: undefined,
        platform_username,
      };
    }
    case "instagram": {
      // Same Meta app as Facebook; must use Instagram redirect_uri (must match auth request)
      const instagramRedirectUri = getRedirectUri("instagram");
      const clientId = process.env.FACEBOOK_APP_ID;
      const clientSecret = process.env.FACEBOOK_APP_SECRET;
      if (!clientId || !clientSecret) return null;
      const url = `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${clientId}&redirect_uri=${encodeURIComponent(instagramRedirectUri)}&client_secret=${clientSecret}&code=${encodeURIComponent(code)}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = (await res.json()) as { access_token?: string; expires_in?: number };
      if (!data.access_token) return null;
      const expiresAt = data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : undefined;
      return { access_token: data.access_token, expires_at: expiresAt };
    }
    default:
      return null;
  }
}

const PLATFORM_NAMES: PlatformName[] = ["facebook", "tiktok", "instagram", "linkedin", "youtube"];

export function getSupportedPlatforms(): PlatformName[] {
  return PLATFORM_NAMES.filter((p) => {
    if (p === "instagram") return !!process.env.FACEBOOK_APP_ID;
    if (p === "facebook") return !!process.env.FACEBOOK_APP_ID;
    if (p === "tiktok") return !!process.env.TIKTOK_CLIENT_KEY;
    if (p === "linkedin") return !!process.env.LINKEDIN_CLIENT_ID;
    if (p === "youtube") return !!process.env.GOOGLE_CLIENT_ID;
    return false;
  });
}
