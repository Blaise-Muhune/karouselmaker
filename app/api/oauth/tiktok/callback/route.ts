import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUser } from "@/lib/server/auth/getUser";
import { upsertPlatformConnection } from "@/lib/server/db";
import { exchangeCode } from "@/lib/oauth/platforms";

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
  await upsertPlatformConnection(user.id, {
    platform: "tiktok",
    access_token: result.access_token,
    refresh_token: result.refresh_token ?? null,
    expires_at: result.expires_at ?? null,
    scope: "user.info.basic,video.publish",
    platform_user_id: result.platform_user_id ?? null,
    platform_username: result.platform_username ?? null,
    meta: { direct_post: true },
  });
  return finish("connected");
}
