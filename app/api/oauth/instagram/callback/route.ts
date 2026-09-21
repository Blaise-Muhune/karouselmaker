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
  pageName?: string;
};

type ResolveResult =
  | { ok: true; link: IgPageLink }
  | { ok: false; pageNames: string[]; detail?: string };

/**
 * Instagram Content Publishing (Facebook Login) needs a Page access token AND
 * an Instagram Business/Creator account actually linked to that Page in Meta.
 * Opting into both assets in the OAuth dialog is not enough by itself.
 */
async function resolveInstagramPageLink(userAccessToken: string): Promise<ResolveResult> {
  const pagesRes = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&limit=50`,
    { headers: { Authorization: `Bearer ${userAccessToken}` } }
  );
  if (!pagesRes.ok) {
    const body = (await pagesRes.json().catch(() => ({}))) as { error?: { message?: string } };
    return { ok: false, pageNames: [], detail: body.error?.message };
  }

  const pagesBody = (await pagesRes.json()) as {
    data?: Array<{
      id?: string;
      name?: string;
      access_token?: string;
      instagram_business_account?: { id?: string; username?: string };
    }>;
  };
  const pages = pagesBody.data ?? [];
  if (pages.length === 0) {
    return {
      ok: false,
      pageNames: [],
      detail: "No Facebook Pages were granted. Opt in to the Page that owns the Instagram account.",
    };
  }

  const pageNames: string[] = [];
  for (const page of pages) {
    if (page.name) pageNames.push(page.name);
    if (!page.id || !page.access_token) continue;

    // Prefer the expand from /me/accounts when present.
    let ig = page.instagram_business_account;

    // Re-query with the Page token — more reliable when OAuth granted Page + IG separately.
    if (!ig?.id) {
      const pageRes = await fetch(
        `https://graph.facebook.com/v21.0/${encodeURIComponent(page.id)}?fields=instagram_business_account{id,username}&access_token=${encodeURIComponent(page.access_token)}`
      );
      if (pageRes.ok) {
        const pageBody = (await pageRes.json()) as {
          instagram_business_account?: { id?: string; username?: string };
        };
        ig = pageBody.instagram_business_account;
      }
    }

    if (ig?.id) {
      return {
        ok: true,
        link: {
          igUserId: ig.id,
          username: ig.username,
          pageAccessToken: page.access_token,
          pageId: page.id,
          pageName: page.name,
        },
      };
    }
  }

  return { ok: false, pageNames };
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
  if (!state || !expectedState || state !== expectedState) {
    return finish("error", "OAuth state could not be verified.");
  }
  const code = params.get("code");
  if (!code) {
    return finish("error", params.get("error_description") ?? "Instagram did not return an authorization code.");
  }
  const result = await exchangeCode("instagram", code);
  if (!result) return finish("error", "Instagram connection failed. Check Meta app permissions.");

  const resolved = await resolveInstagramPageLink(result.access_token);
  if (!resolved.ok) {
    if (resolved.detail && resolved.pageNames.length === 0) {
      return finish("error", resolved.detail);
    }
    const pagesLabel =
      resolved.pageNames.length > 0 ? resolved.pageNames.slice(0, 3).join(", ") : "your selected Page";
    return finish(
      "error",
      `${pagesLabel}: no Instagram linked on the Page. Meta Business Suite / Page settings → Linked accounts → connect the Instagram Business/Creator account, then reconnect.`
    );
  }

  const link = resolved.link;
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
      page_name: link.pageName ?? null,
      direct_post: true,
      user_access_token: result.access_token,
    },
  });
  return finish("connected");
}
