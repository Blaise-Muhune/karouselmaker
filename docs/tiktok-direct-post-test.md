# TikTok Photo Mode scheduling, admin test

The app now has an **admin-only** TikTok Photo Mode scheduling panel on each carousel. It is intentionally limited to private posts while the TikTok application is being tested and audited.

## One-time TikTok setup

1. In TikTok for Developers, enable **Content Posting API → Direct Post** for this app.
2. Request and approve the `video.publish` scope. The app requests `user.info.basic,video.publish` during OAuth.
3. Add this redirect URL to the TikTok app: `https://your-domain.com/api/oauth/tiktok/callback`.
4. Verify `https://your-domain.com` as the URL prefix TikTok may pull media from.
5. Configure these production variables:

   ```text
   NEXT_PUBLIC_APP_URL=https://your-domain.com
   TIKTOK_CLIENT_KEY=...
   TIKTOK_CLIENT_SECRET=...
   CRON_SECRET=...
   ```

`NEXT_PUBLIC_APP_URL` must be the apex HTTPS origin (**no `www`**, not `*.vercel.app`) and must match a domain verified under TikTok URL properties. TikTok does not follow redirects, and Vercel Authentication can block `.vercel.app` media pulls. An optional `TIKTOK_VERIFIED_MEDIA_URL_PREFIX` can override the media origin if needed.

Photo Mode only accepts **JPEG or WebP**. The admin schedule export forces JPEG.

## Admin test flow

1. Open a finished carousel as an admin.
2. In **TikTok Photo Mode, admin test**, connect the test account through TikTok OAuth.
3. Enter a title, description, and future time, then select **Schedule private test**. The app saves the current rendered slides as the immutable scheduled snapshot; no download is required.
4. The scheduled worker checks due jobs every five minutes, creates a private TikTok Photo Mode post, then **polls TikTok status** until the photo pull finishes. Snapshots stay downloadable while TikTok is pulling images, then are retained for seven days for diagnostics.

The API supports up to 35 photos. The queue stores an unguessable media token and only serves those image URLs while a job is scheduled/publishing (and briefly after publish for TikTok retries).

## Limits

- TikTok requires Direct Post apps to query creator settings and honor account privacy options. The implementation uses `SELF_ONLY` for the admin test.
- Until TikTok audits the client, Direct Post uploads remain restricted to private viewing. The connected TikTok **account** must also be Private; otherwise TikTok returns `unaudited_client_can_only_post_to_private_accounts` (often with the content-sharing-guidelines link).
- `published` in the admin panel means TikTok reported `PUBLISH_COMPLETE`. The post is **Only you**, so it will not show on a public profile grid. Open the TikTok app while logged into that account to see it.
- Scheduling happens in Karouselmaker’s cron queue. TikTok does not accept a publish-at time in the Photo Content Posting endpoint.
- The included Vercel cron configuration runs every five minutes. Vercel requires a Pro or Enterprise plan for a sub-daily cron; on Hobby, use another authenticated scheduler or upgrade before deploying this configuration.
- Do not add logo, watermark, promotional branding, or promotional overlay text to content sent through this integration unless TikTok’s current sharing rules allow it.

Official references: [Direct Post](https://developers.tiktok.com/docs/en/content-posting-api-reference-direct-post), [Photo posting](https://developers.tiktok.com/docs/en/content-posting-api-reference-photo-post), and [media transfer](https://developers.tiktok.com/docs/en/content-posting-api-media-transfer-guide).
