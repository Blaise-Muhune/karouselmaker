# Export pipeline

Exports generate 1080×1080 PNG slides from a carousel, bundle them into a ZIP, store them in Supabase Storage, and provide a signed download URL.

## Overview

1. User clicks **Export** in the carousel editor.
2. Client POSTs to `/api/export/[carouselId]`.
3. Server creates an `exports` row with `status: pending`.
4. Server loads project (brand kit), slides (ordered), and templates.
5. For each slide: build HTML from the same render model as SlidePreview, screenshot with Playwright (headless Chromium) at 1080×1080 @2x, upload PNG to storage.
6. Build ZIP (01.png, 02.png, …, caption.txt), upload to storage.
7. Update export row: `status: ready`, `storage_path: <zip path>`.
8. Generate signed download URL for the ZIP, return to client.
9. User clicks **Download ZIP** (signed URL).

On any failure, export row is set to `status: failed` and a clean error message is returned (no raw stack traces).

## Storage paths

- **Bucket:** `carousel-assets` (private).
- **Convention:**
  - `user/{userId}/exports/{carouselId}/{exportId}/slides/01.png`, `02.png`, …
  - `user/{userId}/exports/{carouselId}/{exportId}/carousel.zip`
- RLS: only the owning user can read/write paths under `user/{userId}/...`.

## Signed URL

- **Helper:** `lib/server/storage/signedUrl.ts` → `getSignedDownloadUrl(bucket, path, expiresInSeconds)`.
- Uses Supabase **service role** client so the URL is valid for the private object (default expiry 600s).
- Client uses the URL once to download the ZIP; no client-side secrets.

## Render parity

- **Server HTML:** `lib/server/renderer/renderSlideHtml.ts` builds a full HTML document from the same inputs as SlidePreview: `buildSlideRenderModel` + template config, brand kit, slide data, background override.
- **Route:** `GET /api/render/slide/[slideId]` returns that HTML (auth + carousel ownership required). Used for debugging; export uses `renderSlideHtml` directly and Playwright `setContent(html)`.
- Screenshot viewport: 1080×1080. One browser instance is reused for all slides, then closed.

## Limitations

- **Serverless timeouts:** Export runs in the route handler. Vercel/serverless has a max duration (e.g. 60s); many slides may hit the limit. For production scale, consider a background job (e.g. queue + worker) and polling for completion.
- **Max slides:** No hard cap in code; timeout and memory limit effectively cap the number of slides per export.
- **Background images:** Slide background image URLs are not yet resolved in export (render model has `backgroundImageUrl` but it’s not set from slide assets). Future: resolve asset URLs and pass into `renderSlideHtml`.
- **Fonts:** Export HTML uses system fonts (-apple-system, Segoe UI, Roboto, Arial, sans-serif) so screenshots don’t depend on external font loading.

## Video preview (Remotion)

Carousel slides can be previewed as a video using [Remotion](https://www.remotion.dev/). After exporting, use **Video preview** in the editor to play slides in sequence with fade transitions. The export API returns `slideUrls` (signed URLs for each slide image) for the Remotion Player.

To render an MP4 locally:
```bash
npx remotion render remotion/index.ts CarouselVideo out.mp4 --props='{"slideUrls":["https://...","https://..."], "width":1080, "height":1080}'
```
Requires FFmpeg. Server-side rendering on Vercel is not supported; use [Remotion Lambda](https://www.remotion.dev/docs/lambda) for serverless video rendering.

## Future improvements

- Background images: upload slide images to storage, pass signed or public URLs into render model for export.
- Scheduler / queue: move export to a background job, store job id in export row, poll for completion; return download URL when ready.
- Optional formats: e.g. PDF deck in addition to ZIP of PNGs.
