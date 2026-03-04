/**
 * YouTube Data API v3 – resumable video upload.
 * See https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol
 */

const UPLOAD_INIT_URL = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status";

export interface YouTubeUploadOptions {
  title: string;
  description?: string;
  /** default "public" */
  privacyStatus?: "public" | "private" | "unlisted";
}

export interface YouTubeUploadResult {
  videoId: string;
  videoUrl: string;
}

/**
 * Upload video bytes to the user's YouTube channel via resumable upload.
 * Uses the given access token (must have youtube.upload scope).
 */
export async function uploadVideoToYouTube(
  accessToken: string,
  videoBytes: ArrayBuffer | Buffer,
  options: YouTubeUploadOptions
): Promise<YouTubeUploadResult> {
  const size = videoBytes.byteLength ?? (videoBytes as Buffer).length;
  const body = {
    snippet: {
      title: options.title.slice(0, 100),
      description: (options.description ?? "").slice(0, 5000),
    },
    status: {
      privacyStatus: options.privacyStatus ?? "public",
    },
  };

  const initRes = await fetch(UPLOAD_INIT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": "video/mp4",
      "X-Upload-Content-Length": String(size),
    },
    body: JSON.stringify(body),
  });

  if (!initRes.ok) {
    const errText = await initRes.text();
    throw new Error(`YouTube init upload failed: ${initRes.status} ${errText}`);
  }

  const uploadUrl = initRes.headers.get("Location");
  if (!uploadUrl) {
    throw new Error("YouTube upload: missing Location header");
  }

  const buffer = Buffer.isBuffer(videoBytes) ? videoBytes : Buffer.from(videoBytes);
  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "video/mp4",
      "Content-Length": String(size),
      "Content-Range": `bytes 0-${size - 1}/${size}`,
    },
    body: buffer,
  });

  if (!putRes.ok) {
    const errText = await putRes.text();
    throw new Error(`YouTube upload failed: ${putRes.status} ${errText}`);
  }

  const videoResource = (await putRes.json()) as { id?: string };
  const videoId = videoResource?.id;
  if (!videoId) {
    throw new Error("YouTube upload: no video id in response");
  }

  return {
    videoId,
    videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
  };
}
