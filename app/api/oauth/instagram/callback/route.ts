import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUser } from "@/lib/server/auth/getUser";
import { isAdmin } from "@/lib/server/auth/isAdmin";
import { getPlatformConnection, upsertPlatformConnection } from "@/lib/server/db";
import { getRedirectUri } from "@/lib/oauth/platforms";
import { exchangeInstagramLoginCode, INSTAGRAM_LOGIN_SCOPES } from "@/lib/instagram/instagramLogin";
import { getInstagramLinkedAccounts, type InstagramLinkedAccount } from "@/lib/instagram/accounts";

function safeReturnTo(value: string | undefined) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function GET(request: Request) {
  const { user } = await getUser();
  const params = new URL(request.url).searchParams;
  const cookieStore = await cookies();
  const state = params.get("state");
  const expectedState = cookieStore.get("instagram_oauth_state")?.value;
  const returnTo = safeReturnTo(cookieStore.get("instagram_oauth_return_to")?.value);
  const finish = (status: "connected" | "error", message?: string) => {
    const target = new URL(returnTo, request.url);
    target.searchParams.set("instagram", status);
    if (message) target.searchParams.set("instagram_message", message.slice(0, 220));
    const response = NextResponse.redirect(target);
    response.cookies.delete("instagram_oauth_state");
    response.cookies.delete("instagram_oauth_return_to");
    return response;
  };
  if (!isAdmin(user.email)) return finish("error", "Instagram posting is not available yet.");
  if (!state || !expectedState || state !== expectedState) {
    return finish("error", "OAuth state could not be verified.");
  }
  const code = params.get("code");
  if (!code) {
    return finish("error", params.get("error_description") ?? "Instagram did not return an authorization code.");
  }

  const exchanged = await exchangeInstagramLoginCode({ code, redirectUri: getRedirectUri("instagram") });
  if (!exchanged.ok) return finish("error", exchanged.error);
  const { result } = exchanged;

  const connected: InstagramLinkedAccount = {
    igUserId: result.igUserId,
    username: result.username,
    loginType: "instagram",
    accessToken: result.accessToken,
    expiresAt: result.expiresAt,
    pageId: null,
    pageName: null,
  };

  const existing = await getPlatformConnection(user.id, "instagram");
  const kept = existing
    ? getInstagramLinkedAccounts(existing).filter(
        (a) => a.loginType === "instagram" && a.igUserId !== connected.igUserId
      )
    : [];
  const accounts = [...kept, connected];

  await upsertPlatformConnection(user.id, {
    platform: "instagram",
    access_token: connected.accessToken,
    refresh_token: null,
    expires_at: connected.expiresAt,
    scope: INSTAGRAM_LOGIN_SCOPES,
    platform_user_id: connected.igUserId,
    platform_username: connected.username,
    meta: {
      ig_user_id: connected.igUserId,
      selected_ig_user_id: connected.igUserId,
      accounts,
      direct_post: true,
    },
  });
  return finish("connected");
}
