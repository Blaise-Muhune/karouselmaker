import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getUser } from "@/lib/server/auth/getUser";
import { isAdmin } from "@/lib/server/auth/isAdmin";
import { getAuthUrl } from "@/lib/oauth/platforms";

function safeReturnTo(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function GET(request: Request) {
  const { user } = await getUser();
  if (!isAdmin(user.email)) {
    return NextResponse.json({ error: "Instagram posting is not available yet." }, { status: 403 });
  }
  const state = randomBytes(24).toString("base64url");
  const url = getAuthUrl("instagram", state);
  if (!url) {
    return NextResponse.json(
      { error: "Instagram is not configured. Set FACEBOOK_APP_ID and FACEBOOK_APP_SECRET." },
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
