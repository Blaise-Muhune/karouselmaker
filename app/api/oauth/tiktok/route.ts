import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getUser } from "@/lib/server/auth/getUser";
import { getAuthUrl } from "@/lib/oauth/platforms";

function safeReturnTo(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function GET(request: Request) {
  await getUser();
  const state = randomBytes(24).toString("base64url");
  const url = getAuthUrl("tiktok", state);
  if (!url) return NextResponse.json({ error: "TikTok Client Key is not configured." }, { status: 503 });
  const response = NextResponse.redirect(url);
  response.cookies.set("tiktok_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: true, maxAge: 600, path: "/" });
  response.cookies.set("tiktok_oauth_return_to", safeReturnTo(new URL(request.url).searchParams.get("return_to")), {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: 600,
    path: "/",
  });
  return response;
}
