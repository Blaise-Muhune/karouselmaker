import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/server/auth/isAdmin";
import { getAuthUrl } from "@/lib/oauth/platforms";
import type { PlatformName } from "@/lib/server/db/types";
import { randomBytes } from "crypto";

const PLATFORMS: PlatformName[] = ["facebook", "tiktok", "instagram", "linkedin", "youtube"];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
  if (!PLATFORMS.includes(platform as PlatformName)) {
    return NextResponse.redirect(`${base}/settings/connected-accounts?error=invalid_platform`);
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.redirect(`${base}/login`);
  }
  if (!isAdmin(user.email ?? null)) {
    return NextResponse.redirect(`${base}/settings/connected-accounts?error=admin_only`);
  }

  const state = randomBytes(24).toString("base64url");
  const authUrl = getAuthUrl(platform as PlatformName, state);
  if (!authUrl) {
    return NextResponse.redirect(`${base}/settings/connected-accounts?error=not_configured`);
  }

  const statePayload = JSON.stringify({ state, userId: user.id, platform });
  const res = NextResponse.redirect(authUrl);
  res.cookies.set("oauth_state", statePayload, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10,
    path: "/",
  });
  return res;
}
