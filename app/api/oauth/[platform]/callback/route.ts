import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCode } from "@/lib/oauth/platforms";
import { getPagesForUser, getInstagramAccountsForUser, verifyPageToken } from "@/lib/facebook/postToPage";
import { upsertPlatformConnection } from "@/lib/server/db/platformConnections";
import type { Json, PlatformName } from "@/lib/server/db/types";
import { cookies } from "next/headers";

const PLATFORMS: PlatformName[] = ["facebook", "tiktok", "instagram", "linkedin", "youtube"];
const BASE = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;
  const RETURN_BASE = `${BASE}/settings/connected-accounts/return`;

  if (!PLATFORMS.includes(platform as PlatformName)) {
    return NextResponse.redirect(`${RETURN_BASE}?error=invalid_platform`);
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${RETURN_BASE}?error=${encodeURIComponent(error)}`);
  }
  if (!code || !state) {
    return NextResponse.redirect(`${RETURN_BASE}?error=missing_code`);
  }

  const cookieStore = await cookies();
  const stateCookie = cookieStore.get("oauth_state")?.value;
  if (!stateCookie) {
    return NextResponse.redirect(`${RETURN_BASE}?error=invalid_state`);
  }

  let payload: { state: string; userId: string; platform: string };
  try {
    payload = JSON.parse(stateCookie) as { state: string; userId: string; platform: string };
  } catch {
    return NextResponse.redirect(`${RETURN_BASE}?error=invalid_state`);
  }
  if (payload.state !== state || payload.platform !== platform) {
    return NextResponse.redirect(`${RETURN_BASE}?error=invalid_state`);
  }

  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user || session.user.id !== payload.userId) {
    return NextResponse.redirect(`${RETURN_BASE}?error=session`);
  }

  const token = await exchangeCode(platform as PlatformName, code);
  if (!token) {
    return NextResponse.redirect(`${RETURN_BASE}?error=exchange_failed`);
  }

  let meta: Record<string, unknown> = {};
  let noPage = false;
  let pagePermissionError = false;
  if (platform === "facebook" && token.access_token) {
    try {
      const pages = await getPagesForUser(token.access_token);
      const first = pages[0];
      if (first) {
        const pageOk = await verifyPageToken(first.id, first.access_token);
        if (pageOk) {
          meta = {
            page_id: first.id,
            page_name: first.name,
            page_access_token: first.access_token,
          };
        } else {
          pagePermissionError = true;
          meta = { no_page: true };
        }
      } else {
        noPage = true;
        meta = { no_page: true };
      }
    } catch {
      noPage = true;
      meta = { no_page: true };
    }
  }
  if (platform === "instagram" && token.access_token) {
    try {
      const accounts = await getInstagramAccountsForUser(token.access_token);
      const first = accounts[0];
      if (first) {
        meta = {
          page_id: first.page_id,
          page_name: first.page_name,
          page_access_token: first.page_access_token,
          ig_account_id: first.ig_account_id,
          ig_username: first.ig_username,
        };
      } else {
        noPage = true;
        meta = { no_page: true };
      }
    } catch {
      noPage = true;
      meta = { no_page: true };
    }
  }

  await upsertPlatformConnection(session.user.id, {
    platform: platform as PlatformName,
    access_token: token.access_token,
    refresh_token: token.refresh_token ?? null,
    expires_at: token.expires_at ?? null,
    scope: null,
    platform_user_id: token.platform_user_id ?? null,
    platform_username: token.platform_username ?? null,
    meta: meta as Json,
  });

  let redirectUrl = `${RETURN_BASE}?connected=${platform}`;
  if (platform === "facebook" && noPage) redirectUrl += "&no_page=1";
  if (platform === "facebook" && pagePermissionError) redirectUrl += "&page_permission=0";
  if (platform === "instagram" && noPage) redirectUrl += "&no_page=1";
  const res = NextResponse.redirect(redirectUrl);
  res.cookies.set("oauth_state", "", { maxAge: 0, path: "/" });
  return res;
}
