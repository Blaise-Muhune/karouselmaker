/**
 * Instagram Graph API: create and publish a carousel post.
 * Requires ig_account_id and page_access_token (from connection meta).
 * @see https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media
 */

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

/**
 * Create an image container for use as a carousel item.
 */
async function createImageContainer(
  igUserId: string,
  pageAccessToken: string,
  imageUrl: string
): Promise<string> {
  const params = new URLSearchParams();
  params.set("image_url", imageUrl);
  params.set("is_carousel_item", "true");
  params.set("access_token", pageAccessToken);

  const res = await fetch(`${GRAPH_BASE}/${igUserId}/media`, {
    method: "POST",
    body: params,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  const data = (await res.json()) as { id?: string; error?: { message?: string } };
  if (data.error) throw new Error(data.error.message ?? "Instagram API error");
  if (!data.id) throw new Error("Instagram did not return a container ID");
  return data.id;
}

/**
 * Create carousel container and publish it.
 * Returns the permalink to the published post.
 */
export async function postCarouselToInstagram(
  igUserId: string,
  pageAccessToken: string,
  imageUrls: string[],
  caption?: string
): Promise<{ media_id: string; permalink?: string }> {
  if (imageUrls.length === 0) throw new Error("At least one image required");
  if (imageUrls.length > 10) throw new Error("Instagram carousels support up to 10 items");

  const containerIds: string[] = [];
  for (const url of imageUrls) {
    const id = await createImageContainer(igUserId, pageAccessToken, url);
    containerIds.push(id);
  }

  const params = new URLSearchParams();
  params.set("media_type", "CAROUSEL");
  params.set("children", containerIds.join(","));
  if (caption?.trim()) params.set("caption", caption.trim());
  params.set("access_token", pageAccessToken);

  const createRes = await fetch(`${GRAPH_BASE}/${igUserId}/media`, {
    method: "POST",
    body: params,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  const createData = (await createRes.json()) as { id?: string; error?: { message?: string } };
  if (createData.error) throw new Error(createData.error.message ?? "Instagram API error");
  if (!createData.id) throw new Error("Instagram did not return carousel container ID");

  const publishParams = new URLSearchParams();
  publishParams.set("creation_id", createData.id);
  publishParams.set("access_token", pageAccessToken);

  const publishRes = await fetch(`${GRAPH_BASE}/${igUserId}/media_publish`, {
    method: "POST",
    body: publishParams,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  const publishData = (await publishRes.json()) as {
    id?: string;
    error?: { message?: string };
  };
  if (publishData.error) throw new Error(publishData.error.message ?? "Instagram publish error");
  if (!publishData.id) throw new Error("Instagram did not return media ID");

  let permalink: string | undefined;
  try {
    const permRes = await fetch(
      `${GRAPH_BASE}/${publishData.id}?fields=permalink&access_token=${encodeURIComponent(pageAccessToken)}`
    );
    const permData = (await permRes.json()) as { permalink?: string };
    permalink = permData.permalink;
  } catch {
    // optional
  }

  return { media_id: publishData.id, permalink };
}
