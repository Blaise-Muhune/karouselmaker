# Post to social: APIs and setup

Projects can be configured with **Post to** platforms (Facebook, TikTok, Instagram, LinkedIn, YouTube). The carousel page shows which platforms are enabled. To make **one-click posting** (or scheduled posting) work, you need to integrate each platform’s APIs and store credentials securely.

Below is where to find the official APIs and what you typically need.

---

## 1. Facebook (Meta)

- **Docs:** [Meta for Developers – Sharing](https://developers.facebook.com/docs/sharing), [Graph API](https://developers.facebook.com/docs/graph-api), [Facebook Login](https://developers.facebook.com/docs/facebook-login).
- **Publishing:** [Graph API – Publishing](https://developers.facebook.com/docs/graph-api/using-graph-api/#publishing). For Pages: [Page Posts](https://developers.facebook.com/docs/pages/posts).
- **You need:**
  - A [Meta Developer App](https://developers.facebook.com/apps/) (Facebook App).
  - **Facebook Login** product (OAuth) so users can connect their Facebook/Page.
  - **Pages Read and Write** (or similar) permissions to post on behalf of a Page.
  - **App ID** and **App Secret** in `.env`; store each user’s **Page access token** (and optional Page ID) in your DB after OAuth.
- **Video/carousel:** Graph API supports photo and video posts; carousels can be implemented as multi-photo posts or as a single video depending on format.

---

## 2. TikTok

- **Docs:** [TikTok for Developers](https://developers.tiktok.com/), [Content Posting API](https://developers.tiktok.com/doc/content-posting-api-get-started).
- **You need:**
  - A [TikTok Developer account](https://developers.tiktok.com/) and an app (e.g. “Login Kit” and “Content Posting”).
  - OAuth (Login Kit) so users connect their TikTok account.
  - **Content Posting API** access (apply if required) to upload video (and optionally images).
  - **Client Key** and **Client Secret** in `.env`; store **user access tokens** (and refresh) in your DB.
- **Video only:** TikTok is primarily video; “carousel” there is often multiple clips or a single video. Use the Content Posting API for video upload.

---

## 3. Instagram (Meta)

- **Docs:** [Instagram Graph API](https://developers.facebook.com/docs/instagram-api), [Instagram Content Publishing](https://developers.facebook.com/docs/instagram-api/guides/content-publishing).
- **You need:**
  - A [Meta Developer App](https://developers.facebook.com/apps/) with **Instagram Graph API** product.
  - Instagram Business or Creator account linked to a Facebook Page.
  - **Facebook Login** so users connect the Page (which is linked to Instagram).
  - **instagram_content_publish**, **pages_read_engagement**, etc. (as per docs).
  - Same **App ID / App Secret** as Facebook; store **Page access token** and **Instagram Business Account ID** per user.
- **Video + carousel:** API supports single image/video and [carousel posts](https://developers.facebook.com/docs/instagram-api/guides/content-publishing#carousel-posts) (multiple media items).

---

## 4. LinkedIn

- **Docs:** [LinkedIn API](https://developer.linkedin.com/), [Share on LinkedIn (UGC)](https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/share-api), [Register an application](https://www.linkedin.com/developers/apps).
- **You need:**
  - A [LinkedIn Developer App](https://www.linkedin.com/developers/apps) with **Share on LinkedIn** and **Sign In with LinkedIn**.
  - OAuth 2.0 so users connect their LinkedIn account.
  - **w_member_social** (or appropriate) scope to post as the user.
  - **Client ID** and **Client Secret** in `.env`; store **access tokens** (and refresh) in your DB.
- **Video + carousel:** UGC API supports text, single image, and video. Multi-image “carousels” may need the appropriate post format (see current [Share API](https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/share-api) docs).

---

## 5. YouTube

- **Official Docs:**
  - [YouTube Data API docs](https://developers.google.com/youtube/v3)
  - [Uploading videos with YouTube API](https://developers.google.com/youtube/v3/guides/uploading_a_video)

- **Setup Requirements:**
  - **Google Cloud Project:** Create a project in [Google Cloud Console](https://console.cloud.google.com/) and enable the **YouTube Data API v3** for it. This gives your app permission to manage videos, channels, and related data.
  - **OAuth Credentials:** Create OAuth 2.0 credentials (type: Web application) in the [Credentials section](https://console.cloud.google.com/apis/credentials), including configuring an OAuth consent screen. You'll need to specify authorized redirect URIs that point to your app's OAuth callback endpoint for YouTube.
  - **Required Scopes:**
    - `https://www.googleapis.com/auth/youtube.upload` – allows uploading videos to the user's YouTube channel.
    - `https://www.googleapis.com/auth/youtube` – broad write access (see [full scope list](https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps#obtaining-authorization)).
    - Optionally, you can request less-permissive (read-only) scopes if you just need basic info.
  - **Client ID/Secret:** Set `YOUTUBE_CLIENT_ID` and `YOUTUBE_CLIENT_SECRET` (naming may vary) in your `.env` — **never expose the secret in frontend code**. After OAuth, securely store each user's **refresh_token** (needed for long-term API access, since the access token expires quickly) and optionally the YouTube channel ID in your database, linked to their account.

- **OAuth Integration Flow:**
  1. **User Initiates Connection:** User clicks "Connect YouTube" in your app, which redirects them to Google’s OAuth 2.0 consent screen with appropriate scopes.
  2. **Callback & Token Exchange:** On approval, your backend (using the OAuth redirect callback) exchanges the authorization `code` for an **access token** (short-lived) and a **refresh token** (long-lived).
  3. **Token Storage:** Store these tokens securely, along with any metadata (like channel ID). You will periodically use the refresh token to obtain a fresh access token when making API requests.

- **Posting (Uploading) Videos:**
  - YouTube is strictly video-only for uploads – (images are not supported as posts, and there's no concept of multi-image/carousel as in Insta/Facebook—each upload must be a video file).
  - **API Method:** Use the [`videos.insert`](https://developers.google.com/youtube/v3/docs/videos/insert) endpoint to upload. You must use the **resumable upload** protocol, which is designed for large files and can resume if interrupted.
    - Typical flow: Initiate upload with metadata (title, description, privacy, etc.), get an upload session URL, then upload the video content (e.g. exported MP4 from your carousel generator).
    - You can set thumbnail and metadata after upload.
  - **Rate Limits:** Be aware of YouTube Data API quotas (videos.upload has higher cost per call).
  - **Error Handling:** Handle scenarios like invalid/expired tokens, quota errors, and video processing failures.

- **API Quirks and Notes:**
  - YouTube requires users to have an active channel; uploading to brand accounts and organization-managed channels has additional complexity.
  - The API responds asynchronously: once you upload, the video is processed by YouTube after upload is complete.
  - You can obtain the uploaded video’s URL from the API response to display in-app or copy for the user.

- **Carousel support:** Not available. Each call to the API creates a single video post only. To simulate a "carousel", you must combine images/slides into a single exported video.

- **Example User Data to Store:**
  - `platform = "youtube"`
  - `access_token` (expires quickly; use refresh token)
  - `refresh_token` (persistent; critical)
  - `channel_id` (optional, for targeting uploads)
  - `token_expiry` (optional, track when to refresh)

- **Libraries:** Use libraries for OAuth and YouTube Data API in your language of choice (e.g., [`googleapis`](https://www.npmjs.com/package/googleapis) for Node.js/TypeScript) to simplify token handling and file uploads.

**Summary:**  
YouTube upload integration is purely for video content, requires OAuth (with credential storage & refresh), and uses a multipart "resumable" upload API. There’s no direct support for posting carousels or images only. A common approach is to export the user's carousel as a video (MP4), then upload via the API.

> **References:**  
> [Google Developers – YouTube API Upload Guide](https://developers.google.com/youtube/v3/guides/uploading_a_video)  
> [Managing OAuth 2.0 tokens for YouTube Data API](https://developers.google.com/identity/protocols/oauth2)

---

## Implementation outline in this app

1. **Env:** Add per-platform client IDs and secrets (e.g. `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `TIKTOK_CLIENT_KEY`, etc.). Never commit secrets; use `.env` and `.env.example` (with placeholders).
2. **DB:** Add a table (e.g. `user_connected_accounts` or `platform_tokens`) to store, per user and platform: `platform`, `access_token`, `refresh_token`, `expires_at`, and any ID (e.g. Page ID, Instagram business account ID).
3. **Auth flows:** Implement OAuth “Connect [Platform]” routes (e.g. `/api/auth/facebook`, callback, same for TikTok, Instagram, LinkedIn, YouTube) that exchange code for tokens and save them.
4. **Post actions:** For each platform, add a server action or API route that:
   - Loads the user’s token (and refresh if expired).
   - For **video:** uses the platform’s upload API (e.g. signed URL for YouTube, multipart for TikTok, Graph API for Facebook/Instagram).
   - For **carousel:** uses the platform’s multi-photo or carousel API (Instagram carousel, Facebook multi-photo, etc.). YouTube is skipped for carousel.
5. **UI:** On the carousel page, for each enabled platform show a “Post to [Platform]” button that calls the corresponding post action (and passes export asset URLs or video file). Disable the button if the user hasn’t connected that platform.

Once tokens and env are in place, the existing **Post to** section on the carousel page can be wired to these actions to make posting fully functional.
