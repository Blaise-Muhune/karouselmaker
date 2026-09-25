import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getUser } from "@/lib/server/auth/getUser";
import { canUseInstagram } from "@/lib/server/auth/canUseInstagram";
import { getRedirectUri } from "@/lib/oauth/platforms";
import { buildInstagramAuthUrl, getInstagramLoginCredentials } from "@/lib/instagram/instagramLogin";

function safeReturnTo(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function GET(request: Request) {
  const { user } = await getUser();
  if (!canUseInstagram(user.email)) {
    return NextResponse.json({ error: "Instagram posting is not available yet." }, { status: 403 });
  }
  const state = randomBytes(24).toString("base64url");
  const creds = getInstagramLoginCredentials();
  const forceReauth = new URL(request.url).searchParams.get("switch") === "1";
  const url = creds
    ? buildInstagramAuthUrl(creds.appId, getRedirectUri("instagram"), state, { forceReauth })
    : null;
  if (!url) {
    return NextResponse.json(
      { error: "Instagram is not configured. Set INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET." },
      { status: 503 }
    );
  }
  const response = NextResponse.redirect(url);
  response.cookies.set("instagram_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: 600,
    path: "/",
  });
  response.cookies.set(
    "instagram_oauth_return_to",
    safeReturnTo(new URL(request.url).searchParams.get("return_to")),
    { httpOnly: true, sameSite: "lax", secure: true, maxAge: 600, path: "/" }
  );
  return response;
}
