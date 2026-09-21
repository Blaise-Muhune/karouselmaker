# TikTok Photo Mode scheduling

Karouselmaker supports **Post to TikTok** (Photo Mode Direct Post) on each carousel editor. The flow follows TikTok’s Content Sharing Guidelines: creator settings are queried before post, privacy has no forced default, comments start off, commercial disclosure starts off, and Music Usage Confirmation is required.

## One-time TikTok setup

1. In TikTok for Developers, enable **Content Posting API → Direct Post** for this app.
2. Request and approve the `video.publish` scope. The app requests `user.info.basic,video.publish` during OAuth.
3. Add this redirect URL to the TikTok app: `https://your-domain.com/api/oauth/tiktok/callback`.
4. Verify `https://your-domain.com` as the URL prefix TikTok may pull media from (URL properties).
5. Configure these production variables:

   ```text
   NEXT_PUBLIC_APP_URL=https://your-domain.com
   TIKTOK_CLIENT_KEY=...
   TIKTOK_CLIENT_SECRET=...
   CRON_SECRET=...
   ```

`NEXT_PUBLIC_APP_URL` must be the apex HTTPS origin (**no `www`**, not `*.vercel.app`) and must match a domain verified under TikTok URL properties. TikTok does not follow redirects. An optional `TIKTOK_VERIFIED_MEDIA_URL_PREFIX` can override the media origin if needed.

Photo Mode only accepts **JPEG or WebP**. Schedule export forces JPEG and strips Made-with / logo watermark chrome.

## Creator UX (compliance)

1. Connect TikTok from **Post to TikTok**.
2. The panel loads `creator_info` (avatar, username, allowed privacy levels, comment disabled flag).
3. User must **explicitly choose** visibility (no pre-selected privacy).
4. **Comment** starts unchecked (unless the account forbids comments entirely).
5. **Your brand** / **Branded content** start unchecked; branded content cannot use Only you.
6. **Music Usage Confirmation** must be checked before Schedule.
7. Preview shows title, caption, and photo count.
8. Schedule stores the immutable JPEG export and queues the cron worker.

## Publish path

The scheduled worker (every five minutes) claims due jobs, calls TikTok `content/init` with the stored privacy/comment/brand flags, then polls status until `PUBLISH_COMPLETE` or failure. Media URLs stay live while TikTok pulls images.

## Sandbox / unaudited clients

Until TikTok audits Direct Post for production, TikTok may restrict posts to private accounts and `SELF_ONLY`. The UI still offers whatever privacy options `creator_info` returns; TikTok will reject mismatched options.

## Limits

- 1–35 photos per post.
- Scheduling is Karouselmaker’s queue; TikTok Photo Mode has no native publish-at time.
- Vercel Pro/Enterprise is required for `*/5` crons; Hobby needs another authenticated scheduler.
- Do not add promotional app branding to Direct Post media.

Official references: [Content Sharing Guidelines](https://developers.tiktok.com/doc/content-sharing-guidelines/), [Direct Post](https://developers.tiktok.com/docs/en/content-posting-api-reference-direct-post), [Photo posting](https://developers.tiktok.com/docs/en/content-posting-api-reference-photo-post).
