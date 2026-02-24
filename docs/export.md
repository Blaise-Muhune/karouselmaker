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

## Why export can take a while

Each export does a lot of work **per slide**, all sequential:

1. **Chromium launch** — First run can take a few seconds (or on Vercel, downloading the Chromium binary).
2. **Materialize external images** — Slides that use external image URLs (e.g. Unsplash) are downloaded and re-uploaded to storage before rendering.
3. **Per-slide rendering** — For every slide we:
   - Load full HTML (main slide) in a headless page, wait for **load** (all images/fonts), take a screenshot, upload PNG.
   - Load overlay HTML (text/chrome only), same steps, upload overlay PNG.
   - For each **video variant** (1–3 background images per slide): load background-only HTML, same steps, upload PNG.
4. **Delays** — A short delay (e.g. 200ms) after each load lets layout and fonts settle before the screenshot.

So **10 slides with 2 images each** ≈ 10 × (1 main + 1 overlay + 2 variants) = **40 page loads, 40 screenshots, 40 uploads**, plus network time for images. Reducing the post-load delay (see `SCREENSHOT_DELAY_MS` in the route) speeds things up; making it too low can cause incomplete or flickery screenshots.

## Limitations

- **Serverless timeouts:** Export runs in the route handler. Vercel/serverless has a max duration (e.g. 60s); many slides may hit the limit. For production scale, consider a background job (e.g. queue + worker) and polling for completion.
- **Max slides:** No hard cap in code; timeout and memory limit effectively cap the number of slides per export.
- **Background images:** Slide background image URLs are not yet resolved in export (render model has `backgroundImageUrl` but it’s not set from slide assets). Future: resolve asset URLs and pass into `renderSlideHtml`.
- **Fonts:** Export HTML uses system fonts (-apple-system, Segoe UI, Roboto, Arial, sans-serif) so screenshots don’t depend on external font loading.

## Video preview and MP4 download

After exporting, **Video preview** in the editor mirrors the MP4: when video layer data is available, it shows 2–3 background images per slide cycling in the background (same timing as the export) with the text/overlay layer on top; then it transitions to the next slide. If layer data isn’t available, it falls back to a simple full-slide image slideshow (4 seconds per slide). Works on all devices without extra runtimes.

**Download MP4** uses [FFmpeg.wasm](https://ffmpeg.org/) in the browser. When the export includes **video layer data** (from a recent export), the video is built in two layers per slide: (1) **Background layer** — if a slide has multiple background images (e.g. Unsplash shuffle alternates), they cycle with Ken Burns (zoompan) and short fades between them; (2) **Overlay layer** — text, gradient, counter, and watermark are rendered once per slide on a transparent PNG and composited on top for the full slide duration, with a short fade-in so text “appears.” So backgrounds can change while the text stays fixed. If a slide has only one background or no overlay asset, the video still encodes correctly (single background or full slide). Transitions between slides rotate through fade, wipe left, and slide right. Encoding uses `-crf 20` and a single scale step. The export API returns `slideUrls` and, for video, `slideVideoData` (per-slide `backgroundUrls` and `overlayUrl`); the client fetches assets and runs FFmpeg.wasm to produce the MP4. No server-side video encoding; output plays in any standard player.

## Future improvements

- Background images: upload slide images to storage, pass signed or public URLs into render model for export.
- Scheduler / queue: move export to a background job, store job id in export row, poll for completion; return download URL when ready.
- Optional formats: e.g. PDF deck in addition to ZIP of PNGs.
