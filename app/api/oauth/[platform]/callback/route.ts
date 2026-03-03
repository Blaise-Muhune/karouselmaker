import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCode } from "@/lib/oauth/platforms";
import { upsertPlatformConnection } from "@/lib/server/db/platformConnections";
import type { PlatformName } from "@/lib/server/db/types";
import { cookies } from "next/headers";

const PLATFORMS: PlatformName[] = ["facebook", "tiktok", "instagram", "linkedin", "youtube"];
const BASE = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;
  if (!PLATFORMS.includes(platform as PlatformName)) {
    return NextResponse.redirect(`${BASE}/settings/connected-accounts?error=invalid_platform`);
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${BASE}/settings/connected-accounts?error=${encodeURIComponent(error)}`);
  }
  if (!code || !state) {
    return NextResponse.redirect(`${BASE}/settings/connected-accounts?error=missing_code`);
  }

  const cookieStore = await cookies();
  const stateCookie = cookieStore.get("oauth_state")?.value;
  if (!stateCookie) {
    return NextResponse.redirect(`${BASE}/settings/connected-accounts?error=invalid_state`);
  }

  let payload: { state: string; userId: string; platform: string };
  try {
    payload = JSON.parse(stateCookie) as { state: string; userId: string; platform: string };
  } catch {
    return NextResponse.redirect(`${BASE}/settings/connected-accounts?error=invalid_state`);
  }
  if (payload.state !== state || payload.platform !== platform) {
    return NextResponse.redirect(`${BASE}/settings/connected-accounts?error=invalid_state`);
  }

  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user || session.user.id !== payload.userId) {
    return NextResponse.redirect(`${BASE}/settings/connected-accounts?error=session`);
  }

  const token = await exchangeCode(platform as PlatformName, code);
  if (!token) {
    return NextResponse.redirect(`${BASE}/settings/connected-accounts?error=exchange_failed`);
  }

  await upsertPlatformConnection(session.user.id, {
    platform: platform as PlatformName,
    access_token: token.access_token,
    refresh_token: token.refresh_token ?? null,
    expires_at: token.expires_at ?? null,
    scope: null,
    platform_user_id: token.platform_user_id ?? null,
    platform_username: token.platform_username ?? null,
    meta: {},
  });

  const res = NextResponse.redirect(`${BASE}/settings/connected-accounts?connected=${platform}`);
  res.cookies.set("oauth_state", "", { maxAge: 0, path: "/" });
  return res;
}
