/**
 * Instagram Graph API: create and publish a Reel (video) from a public URL.
 * Video must be publicly accessible when Instagram fetches it.
 * @see https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media
 */

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

/**
 * Create a Reel container and publish it.
 * Returns media_id and optional permalink.
 */
export async function postReelToInstagram(
  igUserId: string,
  pageAccessToken: string,
  videoUrl: string,
  caption?: string
): Promise<{ media_id: string; permalink?: string }> {
  const params = new URLSearchParams();
  params.set("media_type", "REELS");
  params.set("video_url", videoUrl);
  if (caption?.trim()) params.set("caption", caption.trim());
  params.set("access_token", pageAccessToken);

  const createRes = await fetch(`${GRAPH_BASE}/${igUserId}/media`, {
    method: "POST",
    body: params,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  const createData = (await createRes.json()) as { id?: string; error?: { message?: string } };
  if (createData.error) throw new Error(createData.error.message ?? "Instagram API error");
  if (!createData.id) throw new Error("Instagram did not return container ID");

  const publishParams = new URLSearchParams();
  publishParams.set("creation_id", createData.id);
  publishParams.set("access_token", pageAccessToken);

  const publishRes = await fetch(`${GRAPH_BASE}/${igUserId}/media_publish`, {
    method: "POST",
    body: publishParams,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  const publishData = (await publishRes.json()) as { id?: string; error?: { message?: string } };
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
