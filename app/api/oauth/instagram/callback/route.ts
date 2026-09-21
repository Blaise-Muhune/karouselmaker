import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUser } from "@/lib/server/auth/getUser";
import { upsertPlatformConnection } from "@/lib/server/db";
import { exchangeCode } from "@/lib/oauth/platforms";

function safeReturnTo(value: string | undefined) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

type IgPageLink = {
  igUserId: string;
  username?: string;
  pageAccessToken: string;
  pageId: string;
};

/** Instagram Content Publishing with Facebook Login needs a Page access token. */
async function resolveInstagramPageLink(userAccessToken: string): Promise<IgPageLink | null> {
  const pagesRes = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&limit=25`,
    { headers: { Authorization: `Bearer ${userAccessToken}` } }
  );
  if (!pagesRes.ok) return null;
  const pagesBody = (await pagesRes.json()) as {
    data?: Array<{
      id?: string;
      access_token?: string;
      instagram_business_account?: { id?: string; username?: string };
    }>;
  };
  for (const page of pagesBody.data ?? []) {
    const ig = page.instagram_business_account;
    if (ig?.id && page.access_token && page.id) {
      return {
        igUserId: ig.id,
        username: ig.username,
        pageAccessToken: page.access_token,
        pageId: page.id,
      };
    }
  }
  return null;
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
    if (message) target.searchParams.set("instagram_message", message.slice(0, 160));
    const response = NextResponse.redirect(target);
    response.cookies.delete("instagram_oauth_state");
    response.cookies.delete("instagram_oauth_return_to");
    return response;
  };
  if (!state || !expectedState || state !== expectedState) {
    return finish("error", "OAuth state could not be verified.");
  }
  const code = params.get("code");
  if (!code) {
    return finish("error", params.get("error_description") ?? "Instagram did not return an authorization code.");
  }
  const result = await exchangeCode("instagram", code);
  if (!result) return finish("error", "Instagram connection failed. Check Meta app permissions.");

  const link = await resolveInstagramPageLink(result.access_token);
  if (!link) {
    return finish(
      "error",
      "No Instagram Business account linked to a Facebook Page was found. Convert to Business/Creator and link a Page."
    );
  }

  await upsertPlatformConnection(user.id, {
    platform: "instagram",
    access_token: link.pageAccessToken,
    refresh_token: result.refresh_token ?? null,
    expires_at: result.expires_at ?? null,
    scope: "pages_show_list,pages_read_engagement,instagram_basic,instagram_content_publish",
    platform_user_id: link.igUserId,
    platform_username: link.username ?? null,
    meta: {
      ig_user_id: link.igUserId,
      page_id: link.pageId,
      direct_post: true,
      user_access_token: result.access_token,
    },
  });
  return finish("connected");
}
