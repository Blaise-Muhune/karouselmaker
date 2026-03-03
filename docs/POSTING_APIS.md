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

- **Docs:** [YouTube Data API](https://developers.google.com/youtube/v3), [YouTube API – Uploading videos](https://developers.google.com/youtube/v3/guides/uploading_a_video).
- **You need:**
  - A project in [Google Cloud Console](https://console.cloud.google.com/) with **YouTube Data API v3** enabled.
  - [OAuth 2.0 credentials](https://console.cloud.google.com/apis/credentials) (e.g. Web application) and consent screen.
  - Scopes such as `https://www.googleapis.com/auth/youtube.upload` and `https://www.googleapis.com/auth/youtube` (or read-only where needed).
  - **Client ID** and **Client Secret** in `.env`; store **refresh_token** (and optional channel ID) per user after OAuth.
- **Video only:** YouTube is video-only; use the **Videos: insert** (resumable upload) flow for MP4 uploads. No carousel support.

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
