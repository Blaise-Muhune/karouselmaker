type GraphError = { error?: { message?: string; code?: number } };

async function graphJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = (await response.json().catch(() => ({}))) as T & GraphError;
  if (!response.ok || body.error) {
    throw new Error(body.error?.message || `Instagram Graph API failed (${response.status}).`);
  }
  return body;
}

async function waitForContainerReady(containerId: string, accessToken: string): Promise<void> {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const status = await graphJson<{ status_code?: string }>(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(containerId)}?fields=status_code&access_token=${encodeURIComponent(accessToken)}`
    );
    if (status.status_code === "FINISHED") return;
    if (status.status_code === "ERROR") {
      throw new Error("Instagram failed while processing an image. Try exporting again.");
    }
    await new Promise((r) => setTimeout(r, 2_000));
  }
  throw new Error("Instagram is still processing images. Wait a moment and try again.");
}

/**
 * Create and publish an Instagram feed post (single image or carousel)
 * from publicly reachable image URLs.
 */
export async function postCarouselToInstagram(input: {
  accessToken: string;
  igUserId: string;
  imageUrls: string[];
  caption: string;
}): Promise<{ mediaId: string }> {
  if (input.imageUrls.length < 1 || input.imageUrls.length > 10) {
    throw new Error("Instagram posts need between 1 and 10 images.");
  }

  const caption = input.caption.slice(0, 2200);
  let creationId: string;

  if (input.imageUrls.length === 1) {
    const imageUrl = input.imageUrls[0]!;
    const created = await graphJson<{ id: string }>(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(input.igUserId)}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          image_url: imageUrl,
          caption,
          access_token: input.accessToken,
        }),
      }
    );
    creationId = created.id;
    await waitForContainerReady(creationId, input.accessToken);
  } else {
    const childIds: string[] = [];
    for (const imageUrl of input.imageUrls) {
      const created = await graphJson<{ id: string }>(
        `https://graph.facebook.com/v21.0/${encodeURIComponent(input.igUserId)}/media`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            image_url: imageUrl,
            is_carousel_item: "true",
            access_token: input.accessToken,
          }),
        }
      );
      childIds.push(created.id);
    }

    for (const childId of childIds) {
      await waitForContainerReady(childId, input.accessToken);
    }

    const carousel = await graphJson<{ id: string }>(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(input.igUserId)}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          media_type: "CAROUSEL",
          children: childIds.join(","),
          caption,
          access_token: input.accessToken,
        }),
      }
    );
    creationId = carousel.id;
    await waitForContainerReady(creationId, input.accessToken);
  }

  const published = await graphJson<{ id: string }>(
    `https://graph.facebook.com/v21.0/${encodeURIComponent(input.igUserId)}/media_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        creation_id: creationId,
        access_token: input.accessToken,
      }),
    }
  );

  return { mediaId: published.id };
}
