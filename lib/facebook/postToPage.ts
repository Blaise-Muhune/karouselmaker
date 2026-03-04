/**
 * Facebook Graph API helpers for posting to a Page.
 * Requires Page access token (from /me/accounts) and pages_manage_posts.
 */

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

export interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
}

/**
 * Get the list of Pages the user manages. Use the user access token from OAuth.
 */
export async function getPagesForUser(userAccessToken: string): Promise<FacebookPage[]> {
  const url = `${GRAPH_BASE}/me/accounts?fields=id,name,access_token&access_token=${encodeURIComponent(userAccessToken)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Facebook /me/accounts failed: ${res.status} ${err}`);
  }
  const data = (await res.json()) as { data?: { id: string; name: string; access_token: string }[] };
  const list = data.data ?? [];
  return list.map((p) => ({ id: p.id, name: p.name, access_token: p.access_token }));
}

/**
 * Instagram Business Account linked to a Facebook Page (for posting via Instagram Graph API).
 */
export interface InstagramAccount {
  page_id: string;
  page_name: string;
  page_access_token: string;
  ig_account_id: string;
  ig_username: string;
}

/**
 * Get Instagram Business Accounts the user can post to (Pages that have an IG account linked).
 * Requires user token with pages_show_list, pages_read_engagement, instagram_basic.
 */
export async function getInstagramAccountsForUser(userAccessToken: string): Promise<InstagramAccount[]> {
  const pages = await getPagesForUser(userAccessToken);
  const results: InstagramAccount[] = [];
  for (const page of pages) {
    const url = `${GRAPH_BASE}/${page.id}?fields=instagram_business_account{id,username}&access_token=${encodeURIComponent(page.access_token)}`;
    const res = await fetch(url);
    if (!res.ok) continue;
    const data = (await res.json()) as {
      instagram_business_account?: { id: string; username: string };
      error?: { code?: number };
    };
    const ig = data.instagram_business_account;
    if (ig?.id && ig?.username) {
      results.push({
        page_id: page.id,
        page_name: page.name,
        page_access_token: page.access_token,
        ig_account_id: ig.id,
        ig_username: ig.username,
      });
    }
  }
  return results;
}

/**
 * Verify that the Page access token is valid and has at least read access (used to detect tokens that can't post).
 */
export async function verifyPageToken(pageId: string, pageAccessToken: string): Promise<boolean> {
  const url = `${GRAPH_BASE}/${pageId}?fields=id,name&access_token=${encodeURIComponent(pageAccessToken)}`;
  const res = await fetch(url);
  if (!res.ok) return false;
  const data = (await res.json()) as { id?: string; error?: { code?: number } };
  return !!data.id && !data.error;
}

/**
 * Upload a single photo unpublished; returns the photo id for use in multi-photo feed post.
 */
async function uploadPhotoUnpublished(
  pageId: string,
  pageAccessToken: string,
  imageUrl: string
): Promise<string> {
  const params = new URLSearchParams();
  params.set("url", imageUrl);
  params.set("published", "false");
  params.set("access_token", pageAccessToken);

  const res = await fetch(`${GRAPH_BASE}/${pageId}/photos`, {
    method: "POST",
    body: params,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  const body = (await res.json()) as { id?: string; error?: { message: string } };
  if (body.error) throw new Error(body.error.message || "Facebook API error");
  if (!body.id) throw new Error("Facebook did not return a photo ID");
  return body.id;
}

/**
 * Post multiple photos to a Facebook Page as one carousel/multi-photo post.
 * Uploads each image unpublished, then publishes a single feed post with all.
 * Returns the post URL to view on Facebook.
 */
export async function postMultiPhotoToPage(
  pageId: string,
  pageAccessToken: string,
  imageUrls: string[],
  message?: string
): Promise<{ post_id: string; post_url: string }> {
  if (imageUrls.length === 0) throw new Error("At least one image required");

  const photoIds: string[] = [];
  for (const url of imageUrls) {
    const id = await uploadPhotoUnpublished(pageId, pageAccessToken, url);
    photoIds.push(id);
  }

  const attachedMedia = photoIds.map((id) => JSON.stringify({ media_fbid: id }));
  const params = new URLSearchParams();
  params.set("attached_media", `[${attachedMedia.join(",")}]`);
  params.set("published", "true");
  if (message?.trim()) params.set("message", message.trim());
  params.set("access_token", pageAccessToken);

  const res = await fetch(`${GRAPH_BASE}/${pageId}/feed`, {
    method: "POST",
    body: params,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  const body = (await res.json()) as { id?: string; error?: { message: string } };
  if (body.error) throw new Error(body.error.message || "Facebook API error");
  const fullId = body.id ?? "";
  if (!fullId) throw new Error("Facebook did not return a post ID");

  // id is "page_id_post_id"
  const parts = fullId.split("_");
  const postId = parts.length > 1 ? parts[parts.length - 1]! : fullId;
  const postUrl = `https://www.facebook.com/${pageId}/posts/${postId}`;

  return { post_id: fullId, post_url: postUrl };
}

/**
 * Post a video to a Facebook Page by URL.
 * Facebook fetches the video from file_url; it must be publicly accessible (e.g. signed URL valid for several minutes).
 * @see https://developers.facebook.com/docs/video-api/guides/publishing/
 */
export async function postVideoToPage(
  pageId: string,
  pageAccessToken: string,
  videoUrl: string,
  description?: string
): Promise<{ post_id: string; post_url: string }> {
  const params = new URLSearchParams();
  params.set("file_url", videoUrl);
  params.set("published", "true");
  if (description?.trim()) params.set("description", description.trim());
  params.set("access_token", pageAccessToken);

  const res = await fetch(`${GRAPH_BASE}/${pageId}/videos`, {
    method: "POST",
    body: params,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  const body = (await res.json()) as { id?: string; error?: { message: string } };
  if (body.error) throw new Error(body.error.message || "Facebook API error");
  const videoId = body.id;
  if (!videoId) throw new Error("Facebook did not return a video ID");

  const postUrl = `https://www.facebook.com/${pageId}/videos/${videoId}`;
  return { post_id: videoId, post_url: postUrl };
}
