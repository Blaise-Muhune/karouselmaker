const TIKTOK_API = "https://open.tiktokapis.com";

export const TIKTOK_PRIVACY_LEVELS = [
  "PUBLIC_TO_EVERYONE",
  "MUTUAL_FOLLOW_FRIENDS",
  "FOLLOWER_OF_CREATOR",
  "SELF_ONLY",
] as const;

export type TikTokPrivacyLevel = (typeof TIKTOK_PRIVACY_LEVELS)[number];

export type TikTokCreatorInfo = {
  avatarUrl: string | null;
  username: string | null;
  nickname: string | null;
  privacyLevels: TikTokPrivacyLevel[];
  commentDisabled: boolean;
  duetDisabled: boolean;
  stitchDisabled: boolean;
  maxVideoPostDurationSec: number | null;
};

type TikTokApiResponse = {
  data?: {
    publish_id?: string;
    creator_avatar_url?: string;
    creator_username?: string;
    creator_nickname?: string;
    privacy_level_options?: string[];
    comment_disabled?: boolean;
    duet_disabled?: boolean;
    stitch_disabled?: boolean;
    max_video_post_duration_sec?: number;
    status?: string;
    fail_reason?: string;
  };
  error?: { code?: string; message?: string };
};

export type TikTokPublishStatus = {
  status: "PROCESSING_UPLOAD" | "PROCESSING_DOWNLOAD" | "SEND_TO_USER_INBOX" | "PUBLISH_COMPLETE" | "FAILED" | string;
  failReason?: string;
};

function isPrivacyLevel(value: string): value is TikTokPrivacyLevel {
  return (TIKTOK_PRIVACY_LEVELS as readonly string[]).includes(value);
}

/** Map opaque TikTok API messages to actionable guidance. */
function errorMessage(response: TikTokApiResponse, fallback: string) {
  const code = response.error?.code?.trim();
  const message = response.error?.message?.trim();
  if (code === "unaudited_client_can_only_post_to_private_accounts") {
    return "TikTok requires the connected account to be private until Direct Post is audited. Set the TikTok account to Private, choose Only you, then try again.";
  }
  if (code === "url_ownership_unverified") {
    return "TikTok has not verified this app’s media URL. Verify your domain (NEXT_PUBLIC_APP_URL) in TikTok for Developers → URL properties.";
  }
  if (code === "privacy_level_option_mismatch") {
    return "TikTok rejected the privacy setting. Refresh creator settings and pick a privacy option TikTok still allows for this account.";
  }
  if (code === "spam_risk_too_many_posts") {
    return "This TikTok account has reached its posting limit for now. Try again later.";
  }
  if (code === "spam_risk_user_banned_from_posting") {
    return "This TikTok account is currently banned from posting.";
  }
  if (code === "reached_active_user_cap") {
    return "Karouselmaker has reached TikTok’s daily active publisher cap. Try again tomorrow.";
  }
  if (code && message) return `${code}: ${message}`;
  return message || code || fallback;
}

/** TikTok requires this query before a Direct Post so current creator settings are honored. */
export async function getTikTokCreatorInfo(accessToken: string): Promise<TikTokCreatorInfo> {
  const response = await fetch(`${TIKTOK_API}/v2/post/publish/creator_info/query/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
  });
  const body = (await response.json().catch(() => ({}))) as TikTokApiResponse;
  if (!response.ok || (body.error && body.error.code !== "ok")) {
    throw new Error(errorMessage(body, "TikTok creator settings could not be read."));
  }
  const privacyLevels = (body.data?.privacy_level_options ?? []).filter(isPrivacyLevel);
  return {
    avatarUrl: body.data?.creator_avatar_url?.trim() || null,
    username: body.data?.creator_username?.trim() || null,
    nickname: body.data?.creator_nickname?.trim() || null,
    privacyLevels,
    commentDisabled: body.data?.comment_disabled === true,
    duetDisabled: body.data?.duet_disabled === true,
    stitchDisabled: body.data?.stitch_disabled === true,
    maxVideoPostDurationSec:
      typeof body.data?.max_video_post_duration_sec === "number"
        ? body.data.max_video_post_duration_sec
        : null,
  };
}

export type TikTokPhotoPostOptions = {
  accessToken: string;
  photoUrls: string[];
  title: string;
  description: string;
  privacyLevel: TikTokPrivacyLevel;
  /** When true, comments are allowed (disable_comment = false). Must start unchecked in UX. */
  allowComment: boolean;
  brandOrganic: boolean;
  brandContent: boolean;
};

/** Directly creates a TikTok Photo Mode post from public URLs on a verified app domain. */
export async function postPhotosToTikTok(input: TikTokPhotoPostOptions): Promise<{ publishId: string }> {
  if (input.photoUrls.length === 0 || input.photoUrls.length > 35) {
    throw new Error("TikTok requires between 1 and 35 photos.");
  }
  if (input.brandContent && input.privacyLevel === "SELF_ONLY") {
    throw new Error("Branded content cannot use Only you visibility.");
  }

  const creator = await getTikTokCreatorInfo(input.accessToken);
  if (!creator.privacyLevels.includes(input.privacyLevel)) {
    throw new Error("That privacy option is no longer available for this TikTok account. Refresh and choose again.");
  }

  const disableComment = creator.commentDisabled || !input.allowComment;

  const response = await fetch(`${TIKTOK_API}/v2/post/publish/content/init/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      post_info: {
        title: input.title.slice(0, 90),
        description: input.description.slice(0, 4000),
        privacy_level: input.privacyLevel,
        disable_comment: disableComment,
        auto_add_music: true,
        brand_content_toggle: input.brandContent,
        brand_organic_toggle: input.brandOrganic,
      },
      source_info: {
        source: "PULL_FROM_URL",
        photo_cover_index: 0,
        photo_images: input.photoUrls,
      },
      post_mode: "DIRECT_POST",
      media_type: "PHOTO",
    }),
  });
  const body = (await response.json().catch(() => ({}))) as TikTokApiResponse;
  if (!response.ok || (body.error && body.error.code !== "ok")) {
    throw new Error(errorMessage(body, "TikTok photo post could not be scheduled."));
  }
  const publishId = body.data?.publish_id;
  if (!publishId) throw new Error("TikTok did not return a publish ID.");
  return { publishId };
}

/** Poll until TikTok finishes pulling photos or fails. Init success alone is not enough. */
export async function fetchTikTokPublishStatus(accessToken: string, publishId: string): Promise<TikTokPublishStatus> {
  const response = await fetch(`${TIKTOK_API}/v2/post/publish/status/fetch/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({ publish_id: publishId }),
  });
  const body = (await response.json().catch(() => ({}))) as TikTokApiResponse;
  if (!response.ok || (body.error && body.error.code !== "ok")) {
    throw new Error(errorMessage(body, "TikTok publish status could not be read."));
  }
  const status = body.data?.status?.trim();
  if (!status) throw new Error("TikTok did not return a publish status.");
  return {
    status,
    failReason: body.data?.fail_reason?.trim() || undefined,
  };
}

function publishFailMessage(failReason: string | undefined) {
  switch (failReason) {
    case "photo_pull_failed":
      return "TikTok could not download the slide images (photo_pull_failed). Confirm karouselmaker.com is verified under URL properties, then schedule a new post.";
    case "picture_size_check_failed":
      return "TikTok rejected a slide image size. Export again at the carousel size and retry.";
    case "file_format_check_failed":
      return "TikTok rejected the image format. Export as JPEG and retry.";
    case "spam_risk_text":
      return "TikTok blocked the title or description as spam risk. Edit the text and retry.";
    default:
      return failReason ? `TikTok publish failed (${failReason}).` : "TikTok publish failed.";
  }
}

/** Waits for Direct Post download/publish to finish within the cron budget. */
export async function waitForTikTokPublishComplete(input: {
  accessToken: string;
  publishId: string;
  timeoutMs?: number;
  intervalMs?: number;
}): Promise<{ status: "complete" } | { status: "failed"; error: string } | { status: "pending" }> {
  const timeoutMs = input.timeoutMs ?? 45_000;
  const intervalMs = input.intervalMs ?? 3_000;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const current = await fetchTikTokPublishStatus(input.accessToken, input.publishId);
    if (current.status === "PUBLISH_COMPLETE") return { status: "complete" };
    if (current.status === "FAILED") return { status: "failed", error: publishFailMessage(current.failReason) };
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return { status: "pending" };
}

export async function refreshTikTokAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
}> {
  const clientKey = process.env.TIKTOK_CLIENT_KEY?.trim();
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET?.trim();
  if (!clientKey || !clientSecret) throw new Error("TikTok credentials are not configured.");
  const response = await fetch(`${TIKTOK_API}/v2/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !body.access_token) {
    throw new Error(body.error_description || body.error || "TikTok access token refresh failed.");
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: body.expires_in ? new Date(Date.now() + body.expires_in * 1000).toISOString() : undefined,
  };
}

export function privacyLevelLabel(level: TikTokPrivacyLevel): string {
  switch (level) {
    case "PUBLIC_TO_EVERYONE":
      return "Everyone";
    case "MUTUAL_FOLLOW_FRIENDS":
      return "Friends";
    case "FOLLOWER_OF_CREATOR":
      return "Followers";
    case "SELF_ONLY":
      return "Only you";
  }
}
