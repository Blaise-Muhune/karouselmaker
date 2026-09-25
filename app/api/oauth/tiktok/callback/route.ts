import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUser } from "@/lib/server/auth/getUser";
import { exchangeCode } from "@/lib/oauth/platforms";
import { addTikTokAccount } from "@/lib/server/tiktok/accounts";
import { rememberAccountForReturnPath } from "@/lib/server/projectSocialAccounts";

function safeReturnTo(value: string | undefined) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function GET(request: Request) {
  const { user } = await getUser();
  const params = new URL(request.url).searchParams;
  const cookieStore = await cookies();
  const state = params.get("state");
  const expectedState = cookieStore.get("tiktok_oauth_state")?.value;
  const returnTo = safeReturnTo(cookieStore.get("tiktok_oauth_return_to")?.value);
  const finish = (status: "connected" | "error", message?: string) => {
    const target = new URL(returnTo, request.url);
    target.searchParams.set("tiktok", status);
    if (message) target.searchParams.set("tiktok_message", message.slice(0, 160));
    const response = NextResponse.redirect(target);
    response.cookies.delete("tiktok_oauth_state");
    response.cookies.delete("tiktok_oauth_return_to");
    return response;
  };
  if (!state || !expectedState || state !== expectedState) return finish("error", "OAuth state could not be verified.");
  const code = params.get("code");
  if (!code) return finish("error", params.get("error_description") ?? "TikTok did not return an authorization code.");
  const result = await exchangeCode("tiktok", code);
  if (!result) return finish("error", "TikTok connection failed. Check the app’s Direct Post scope.");
  if (!result.platform_user_id) return finish("error", "TikTok did not return the account id. Try connecting again.");
  await addTikTokAccount(user.id, {
    openId: result.platform_user_id,
    username: result.platform_username ?? null,
    accessToken: result.access_token,
    refreshToken: result.refresh_token ?? null,
    expiresAt: result.expires_at ?? null,
  });
  await rememberAccountForReturnPath(user.id, returnTo, "tiktok", result.platform_user_id);
  return finish("connected");
}
