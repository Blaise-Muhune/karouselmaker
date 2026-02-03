# Assets and slide backgrounds

Users can upload images to a personal library (per project or global) and set any image as a slide background. The renderer and export pipeline use the image with template overlay rules (gradient/darken).

## Asset table

- **id** — uuid, primary key
- **user_id** — uuid, not null, references auth.users (on delete cascade)
- **project_id** — uuid, nullable, references projects (on delete set null). Null = global library for the user.
- **kind** — text, default `'image'` (future: video)
- **file_name** — text, not null
- **storage_path** — text, not null, unique. Full path in bucket.
- **width**, **height** — int, nullable
- **blurhash** — text, optional
- **created_at** — timestamptz

Indexes: `user_id`, `project_id`. RLS: user can select/insert/update/delete only their rows (`user_id = auth.uid()`).

## Storage paths

- **Bucket:** `carousel-assets` (private).
- **Convention:** `user/{userId}/assets/{assetId}/{originalFileName}`

Uploads go to this path; RLS allows only `user/{auth.uid()}/...`.

## Signed URL usage

- **Display (preview, picker, grid):** `getSignedImageUrl(bucket, path, expiresInSeconds)` — creates a signed URL with `download: false` for viewing in `<img>` or CSS `background-image`. Default expiry 600s.
- **Download (ZIP):** `getSignedDownloadUrl` for export ZIP.
- All image URLs are generated server-side (editor page, export route, asset picker). No public bucket; signed URLs only.

## Slide background JSON shape

Stored in `slides.background` (jsonb).

**Solid/gradient (legacy):**
```json
{
  "style": "solid" | "gradient",
  "color": "#hex",
  "gradientOn": true
}
```

**Image mode:**
```json
{
  "mode": "image",
  "asset_id": "uuid",
  "storage_path": "user/{userId}/assets/{assetId}/{fileName}",
  "fit": "cover",
  "overlay": {
    "gradient": true,
    "darken": 0.35,
    "blur": 0
  }
}
```

- **storage_path** — used to generate signed URLs for preview and export (no need to resolve asset row for URL).
- **overlay** — gradient toggles template overlay; darken/blur reserved for future CSS.

When user clears the image, background reverts to solid/gradient (style, color, gradientOn).

## Renderer and export

- **SlidePreview:** Receives `backgroundImageUrl` (signed URL) when `slide.background.mode === 'image'`. Parent (editor page or SlideGrid) resolves signed URL server-side and passes it. Overlay gradient follows template config or `background.overlay.gradient`.
- **Export:** For each slide with `background.mode === 'image'` and `storage_path`, the export route calls `getSignedImageUrl` (short expiry, e.g. 300s), passes the URL into `renderSlideHtml`, and Playwright screenshots the HTML so the image is included in the PNG.
- **GET /api/render/slide/[slideId]:** Same logic: if slide has image background, resolve signed URL and pass to `renderSlideHtml` for parity.

## Upload and validation

- **uploadAsset** (server action): Accepts `project_id` (optional) and `file` via FormData. Validates `image/*` (JPEG, PNG, WebP, GIF) and max size 8MB. Creates asset row with `storage_path = user/{userId}/assets/{assetId}/{fileName}`, then uploads file to that path.
- **setSlideBackground** (server action): Updates `slides.background` with the given patch; enforces ownership via slide → carousel → user.

## Export considerations

- Signed URLs for background images in export HTML are short-lived; generation happens just before each slide is rendered, so they are valid when Playwright loads the image.
- If an asset is deleted after a slide references it, export and preview will show a broken image until the user picks another background or clears the image.
