/**
 * TikTok Content Posting API: upload video to user's TikTok inbox.
 * Scope: video.upload. User completes the post in the TikTok app (inbox notification).
 * @see https://developers.tiktok.com/doc/content-posting-api-reference-upload-video
 * @see https://developers.tiktok.com/doc/content-posting-api-media-transfer-guide
 */

const TIKTOK_API = "https://open.tiktokapis.com";

/** Min chunk 5MB, max 64MB; last chunk can be up to 128MB. Videos <5MB must be one chunk. */
const MIN_CHUNK = 5 * 1024 * 1024;
const PREFERRED_CHUNK = 10 * 1024 * 1024;

export type TikTokUploadResult =
  | { ok: true; publish_id: string }
  | { ok: false; error: string };

/**
 * Initialize video upload (FILE_UPLOAD). Returns publish_id and upload_url for chunked PUT.
 */
async function initVideoUpload(
  accessToken: string,
  videoSize: number,
  chunkSize: number,
  totalChunkCount: number
): Promise<{ publish_id: string; upload_url: string }> {
  const res = await fetch(`${TIKTOK_API}/v2/post/publish/inbox/video/init/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      source_info: {
        source: "FILE_UPLOAD",
        video_size: videoSize,
        chunk_size: chunkSize,
        total_chunk_count: totalChunkCount,
      },
    }),
  });
  const data = (await res.json()) as {
    data?: { publish_id?: string; upload_url?: string };
    error?: { code?: string; message?: string };
  };
  if (!res.ok) {
    const msg = (data as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  if (data.error && data.error.code !== "ok") {
    throw new Error(data.error.message ?? "TikTok init failed.");
  }
  const publishId = data.data?.publish_id;
  const uploadUrl = data.data?.upload_url;
  if (!publishId || !uploadUrl) throw new Error("TikTok init did not return publish_id or upload_url");
  return { publish_id: publishId, upload_url: uploadUrl };
}

/**
 * Upload video to TikTok via Content Posting API (FILE_UPLOAD).
 * Video goes to the user's TikTok inbox; they open the app to finish posting.
 */
export async function uploadVideoToTiktok(
  accessToken: string,
  videoBuffer: Buffer
): Promise<TikTokUploadResult> {
  const videoSize = videoBuffer.length;
  if (videoSize === 0) return { ok: false, error: "Video is empty." };

  let chunkSize: number;
  let totalChunkCount: number;
  if (videoSize < MIN_CHUNK) {
    chunkSize = videoSize;
    totalChunkCount = 1;
  } else {
    chunkSize = PREFERRED_CHUNK; // 10MB; last chunk can be smaller
    totalChunkCount = Math.ceil(videoSize / chunkSize);
  }

  const { publish_id, upload_url } = await initVideoUpload(accessToken, videoSize, chunkSize, totalChunkCount);

  for (let i = 0; i < totalChunkCount; i++) {
    const start = i * chunkSize;
    const end = i === totalChunkCount - 1 ? videoSize - 1 : start + chunkSize - 1;
    const chunk = videoBuffer.subarray(start, end + 1);
    const res = await fetch(upload_url, {
      method: "PUT",
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(chunk.length),
        "Content-Range": `bytes ${start}-${end}/${videoSize}`,
      },
      body: new Uint8Array(chunk),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `Upload chunk failed: ${res.status} ${text}` };
    }
    const expectedStatus = i === totalChunkCount - 1 ? 201 : 206;
    if (res.status !== expectedStatus) {
      return { ok: false, error: `Unexpected status ${res.status} (expected ${expectedStatus})` };
    }
  }

  return { ok: true, publish_id };
}
