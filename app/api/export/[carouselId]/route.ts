import { cacheRender, getCachedRender, renderCacheKey } from "@/lib/server/export/renderCache";
import { waitForSlideReady } from "@/lib/server/browser/waitForSlideReady";
import { NextResponse } from "next/server";
import { launchChromium } from "@/lib/server/browser/launchChromium";
import { createClient } from "@/lib/supabase/server";
import {
  getCarousel,
  getProject,
  getTemplate,
  listSlides,
  createExport,
  updateExport,
  getAsset,
} from "@/lib/server/db";
import { getExportStoragePaths } from "@/lib/server/db/exports";
import { getDefaultTemplateId } from "@/lib/server/db/templates";
import { templateConfigSchema } from "@/lib/server/renderer/templateSchema";
import { renderSlideHtml } from "@/lib/server/renderer/renderSlideHtml";
import { resolveBrandKitLogo } from "@/lib/server/brandKit";
import { getSignedImageUrl } from "@/lib/server/storage/signedImageUrl";
import { createProxyImageUrl } from "@/lib/server/proxyImageUrl";
import {
  normalizeSlideMetaForRender,
  getTemplateDefaultOverrides,
  mergeWithTemplateDefaults,
  mergedHighlightStylesForSlideHtml,
} from "@/lib/server/export/normalizeSlideMetaForRender";
import { buildSlideBackgroundOverrideForRasterExport } from "@/lib/server/export/buildSlideBackgroundOverride";
import { resolveImageDisplay } from "@/lib/server/export/resolveSlideBackgroundFromTemplate";
import {
  downloadStorageImageAsDataUrl,
  fetchImageAsDataUrl,
} from "@/lib/server/export/fetchImageAsDataUrl";
import type { BrandKit } from "@/lib/renderer/renderModel";
import { slugifyForFilename } from "@/lib/utils";
import { buildCarouselPdfFromPngPages } from "@/lib/server/export/buildCarouselPdf";

import JSZip from "jszip";

const BUCKET = "carousel-assets";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

function normalizeStoragePathForBucket(path: string | undefined, bucket: string): string | undefined {
  const trimmed = path?.trim().replace(/^\/+/, "");
  if (!trimmed) return undefined;
  const bucketPrefix = `${bucket}/`;
  return trimmed.startsWith(bucketPrefix) ? trimmed.slice(bucketPrefix.length) : trimmed;
}

type ExportRequestOptions = {
  imageOverlay: boolean;
  format?: "png" | "jpeg" | "pdf";
  size?: "1080x1080" | "1080x1350" | "1080x1920";
  /** Store a fixed export for an in-app destination without sending a file to the browser. */
  delivery?: "download" | "prepare" | "schedule";
};

async function readExportRequestOptions(request: Request): Promise<ExportRequestOptions> {
  try {
    const ct = request.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) return { imageOverlay: true };
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return { imageOverlay: true };
    const value = body as { image_overlay?: unknown; format?: unknown; size?: unknown; delivery?: unknown };
    return {
      imageOverlay: typeof value.image_overlay === "boolean" ? value.image_overlay : true,
      format: value.format === "png" || value.format === "jpeg" || value.format === "pdf" ? value.format : undefined,
      size:
        value.size === "1080x1080" || value.size === "1080x1350" || value.size === "1080x1920"
          ? value.size
          : undefined,
      delivery:
        value.delivery === "schedule" || value.delivery === "prepare"
          ? value.delivery
          : "download",
    };
  } catch {
    /* empty or non-JSON body */
  }
  return { imageOverlay: true };
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ carouselId: string }> }
) {
  const requestOptions = await readExportRequestOptions(_request);
  const imageOverlay = requestOptions.imageOverlay;
  const { carouselId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = user.id;

  const carousel = await getCarousel(userId, carouselId);
  if (!carousel) {
    return NextResponse.json({ error: "Carousel not found" }, { status: 404 });
  }

  const carouselExportFormat = requestOptions.format ?? (carousel as { export_format?: string }).export_format ?? "png";
  const carouselExportSize = requestOptions.size ?? (carousel as { export_size?: string }).export_size ?? "1080x1350";
  const exportMode = carouselExportFormat === "jpeg" || carouselExportFormat === "pdf" ? carouselExportFormat : "png";
  // pdf-lib embeds PNG pages, so render PNG frames when assembling a PDF.
  const rasterFormat = exportMode === "jpeg" ? "jpeg" : "png";
  const dimensions =
    carouselExportSize === "1080x1350"
      ? { w: 1080, h: 1350 }
      : carouselExportSize === "1080x1920"
        ? { w: 1080, h: 1920 }
        : { w: 1080, h: 1080 };

  let exportId: string;
  try {
    const exportRow = await createExport(userId, carouselId, exportMode);
    exportId = exportRow.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create export";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  try {
    const project = await getProject(userId, carousel.project_id);
    if (!project) {
      await updateExport(userId, exportId, { status: "failed" });
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const brandKit: BrandKit = await resolveBrandKitLogo(
      project.brand_kit as Record<string, unknown> | null
    );
    const slides = await listSlides(userId, carouselId);
    if (slides.length === 0) {
      await updateExport(userId, exportId, { status: "failed" });
      return NextResponse.json({ error: "Carousel has no slides" }, { status: 400 });
    }

    const defaultTemplateId = await getDefaultTemplateId(userId);
    /** Collect slide PNG/JPEG buffers in memory; we do not persist to storage. */
    const slideBuffers: Buffer[] = [];

    const CONTENT_TIMEOUT_MS = 25000;
    const SELECTOR_TIMEOUT_MS = 30000;
    const MAX_EXPORT_ATTEMPTS = 3;

    let lastError: unknown = null;
    for (let attempt = 1; attempt <= MAX_EXPORT_ATTEMPTS; attempt++) {
      slideBuffers.length = 0;
      let browser: Awaited<ReturnType<typeof launchChromium>> | undefined;
      try {
      for (let i = 0; i < slides.length; i++) {

        const slide = slides[i];
        if (!slide) continue;

        const templateId = slide.template_id ?? defaultTemplateId;
        if (!templateId) {
          await updateExport(userId, exportId, { status: "failed" });
          return NextResponse.json(
            { error: `Slide ${slide.slide_index} has no template` },
            { status: 400 }
          );
        }

        const template = await getTemplate(userId, templateId);
        if (!template) {
          await updateExport(userId, exportId, { status: "failed" });
          return NextResponse.json(
            { error: `Template not found for slide ${slide.slide_index}` },
            { status: 404 }
          );
        }

        const config = templateConfigSchema.safeParse(template.config);
        if (!config.success) {
          await updateExport(userId, exportId, { status: "failed" });
          return NextResponse.json(
            { error: `Invalid template config for slide ${slide.slide_index}` },
            { status: 400 }
          );
        }

        const slideBg = slide.background as
          | {
              style?: "solid" | "gradient" | "pattern";
              pattern?: "dots" | "ovals" | "lines" | "circles";
              color?: string;
              gradientOn?: boolean;
              mode?: string;
              asset_id?: string;
              storage_path?: string;
              image_url?: string;
              secondary_storage_path?: string;
              secondary_image_url?: string;
              images?: Array<{
                image_url?: string;
                storage_path?: string;
                asset_id?: string;
                unsplash_attribution?: { photographerName: string; photographerUsername: string; profileUrl: string; unsplashUrl: string };
                pixabay_attribution?: { userName: string; userId: number; pageURL: string; photoURL: string };
                pexels_attribution?: { photographer: string; photographer_url: string; photo_url: string };
              }>;
              image_display?: Record<string, unknown>;
              overlay?: {
                enabled?: boolean;
                gradient?: boolean;
                darken?: number;
                color?: string;
                textColor?: string;
                direction?: string;
                extent?: number;
                solidSize?: number;
                tintColor?: string;
                tintOpacity?: number;
              };
              unsplash_attribution?: { photographerName: string; photographerUsername: string; profileUrl: string; unsplashUrl: string };
              pixabay_attribution?: { userName: string; userId: number; pageURL: string; photoURL: string };
              pexels_attribution?: { photographer: string; photographer_url: string; photo_url: string };
            }
          | null
          | undefined;

        const templateCfg = config.data;
        const slideMetaForBg = (slide.meta ?? null) as Record<string, unknown> | null;
        const pictureCompositionOnly = slideMetaForBg?.picture_composition_only === true;
        const backgroundOverride = buildSlideBackgroundOverrideForRasterExport(
          slideBg,
          templateCfg,
          slideMetaForBg,
          imageOverlay,
          pictureCompositionOnly
        );

        let backgroundImageUrl: string | null = null;
        let backgroundImageUrls: string[] | null = null;
        let secondaryBackgroundImageUrl: string | null = null;
        const appOrigin = (() => {
          try {
            return new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").origin;
          } catch {
            return "http://localhost:3000";
          }
        })();
        if (slideBg?.mode === "image") {
          if (slideBg.images?.length) {
            const resolved: string[] = [];
            for (const img of slideBg.images) {
              const storagePath =
                normalizeStoragePathForBucket(img.storage_path, BUCKET) ||
                (img.asset_id
                  ? normalizeStoragePathForBucket((await getAsset(userId, img.asset_id))?.storage_path, BUCKET)
                  : undefined);
              let data =
                (storagePath && (await downloadStorageImageAsDataUrl(BUCKET, storagePath)))
                ?? (img.image_url && /^https?:\/\//i.test(img.image_url) ? await fetchImageAsDataUrl(img.image_url) : null);
              if (!data && img.image_url && /^https?:\/\//i.test(img.image_url)) {
                const proxyUrl = createProxyImageUrl(img.image_url, appOrigin);
                if (proxyUrl) data = await fetchImageAsDataUrl(proxyUrl);
              }
              if (!data && storagePath) {
                try {
                  data = await getSignedImageUrl(BUCKET, storagePath, 600);
                } catch {
                  // keep null
                }
              }
              if (data) resolved.push(data);
              else if (img.image_url && /^https?:\/\//i.test(img.image_url)) resolved.push(img.image_url);
              else if (storagePath) {
                try {
                  resolved.push(await getSignedImageUrl(BUCKET, storagePath, 600));
                } catch {
                  // skip this slot
                }
              }
            }
            if (resolved.length === 1) backgroundImageUrl = resolved[0] ?? null;
            else if (resolved.length >= 2) backgroundImageUrls = resolved;
          } else {
            const trimmedPath = normalizeStoragePathForBucket(
              slideBg.storage_path ?? (slideBg.asset_id ? (await getAsset(userId, slideBg.asset_id))?.storage_path : undefined),
              BUCKET
            );
            if (trimmedPath) {
              backgroundImageUrl = await downloadStorageImageAsDataUrl(BUCKET, trimmedPath);
              if (!backgroundImageUrl) {
                try {
                  backgroundImageUrl = await getSignedImageUrl(BUCKET, trimmedPath, 600);
                } catch {
                  // keep null
                }
              }
            }
            if (!backgroundImageUrl && slideBg.image_url && /^https?:\/\//i.test(slideBg.image_url)) {
              backgroundImageUrl = await fetchImageAsDataUrl(slideBg.image_url);
              if (!backgroundImageUrl) {
                const proxyUrl = createProxyImageUrl(slideBg.image_url, appOrigin);
                if (proxyUrl) backgroundImageUrl = await fetchImageAsDataUrl(proxyUrl);
              }
              if (!backgroundImageUrl) backgroundImageUrl = slideBg.image_url;
            }
          }
          if (slide.slide_type === "hook" && !backgroundImageUrls) {
            if (slideBg.secondary_storage_path) {
              const secPath = normalizeStoragePathForBucket(slideBg.secondary_storage_path, BUCKET);
              if (secPath) {
                secondaryBackgroundImageUrl = await downloadStorageImageAsDataUrl(BUCKET, secPath);
                if (!secondaryBackgroundImageUrl) {
                  try {
                    secondaryBackgroundImageUrl = await getSignedImageUrl(BUCKET, secPath, 600);
                  } catch {
                    // keep null
                  }
                }
              }
            }
            if (!secondaryBackgroundImageUrl && slideBg.secondary_image_url && /^https?:\/\//i.test(slideBg.secondary_image_url)) {
              secondaryBackgroundImageUrl = await fetchImageAsDataUrl(slideBg.secondary_image_url);
              if (!secondaryBackgroundImageUrl) {
                const proxyUrl = createProxyImageUrl(slideBg.secondary_image_url, appOrigin);
                if (proxyUrl) secondaryBackgroundImageUrl = await fetchImageAsDataUrl(proxyUrl);
              }
              if (!secondaryBackgroundImageUrl) secondaryBackgroundImageUrl = slideBg.secondary_image_url;
            }
          }
        }
        const borderedFrame = !!(backgroundImageUrl || (backgroundImageUrls?.length ?? 0) > 0);

        const slideMeta = (slide.meta ?? null) as Record<string, unknown> | null;
        const defaultShowWatermark = false; // logo only when user explicitly enabled it
        const normalized = normalizeSlideMetaForRender(slideMeta);
        const templateDefaults = getTemplateDefaultOverrides(config.data);
        const merged = mergeWithTemplateDefaults(normalized, templateDefaults);
        const showCounterOverride = merged.showCounterOverride;
        const showWatermarkOverride = merged.showWatermarkOverride ?? defaultShowWatermark;
        const showMadeWithOverride = merged.showMadeWithOverride ?? false;
        const fontOverrides = merged.fontOverrides;
        const zoneOverrides = merged.zoneOverrides;
        const chromeOverrides = merged.chromeOverrides;
        const highlightStyles = mergedHighlightStylesForSlideHtml(merged);
        const imageDisplayParam = resolveImageDisplay(config.data, slideBg, slideMeta);

        const html = renderSlideHtml(
          {
            headline: slide.headline,
            body: slide.body ?? null,
            slide_index: slide.slide_index,
            slide_type: slide.slide_type,
            ...(merged.headline_highlights?.length && { headline_highlights: merged.headline_highlights }),
            ...(merged.body_highlights?.length && { body_highlights: merged.body_highlights }),
            ...(merged.extraTextHighlights &&
              Object.keys(merged.extraTextHighlights).length > 0 && { extra_text_highlights: merged.extraTextHighlights }),
          },
          config.data,
          brandKit,
          slides.length,
          backgroundOverride,
          backgroundImageUrl,
          backgroundImageUrls,
          secondaryBackgroundImageUrl,
          showCounterOverride,
          showWatermarkOverride,
          showMadeWithOverride,
          fontOverrides,
          zoneOverrides,
          chromeOverrides,
          highlightStyles,
          merged.outlineStrokes,
          merged.boldWeights,
          (slide.meta as { headline_font_size_spans?: { start: number; end: number; fontSize: number }[] })?.headline_font_size_spans,
          (slide.meta as { body_font_size_spans?: { start: number; end: number; fontSize: number }[] })?.body_font_size_spans,
          borderedFrame,
          imageDisplayParam,
          dimensions,
          undefined,
          undefined,
          pictureCompositionOnly,
          undefined,
          slideMeta
        );

        const cacheKey = renderCacheKey(userId, html, rasterFormat, dimensions.w, dimensions.h);
        const cached = getCachedRender(cacheKey);
        if (cached) { slideBuffers.push(cached); continue; }
        browser ??= await launchChromium();
        const page = await browser.newPage();
        try {
          await page.setViewportSize({ width: dimensions.w, height: dimensions.h });
          await page.setContent(html, { waitUntil: "load", timeout: CONTENT_TIMEOUT_MS });
          await page.waitForSelector(".slide-wrap", { state: "visible", timeout: SELECTOR_TIMEOUT_MS });
          await waitForSlideReady(page, CONTENT_TIMEOUT_MS);
          const buffer = await page.locator(".slide-wrap").screenshot({ type: rasterFormat, timeout: SELECTOR_TIMEOUT_MS });
          const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
          cacheRender(cacheKey, buf);
          slideBuffers.push(buf);
          await page.setContent("about:blank", { waitUntil: "domcontentloaded" });
        } finally {
          try {
            await page.close();
          } catch {
            // ignore
          }
        }
      }
    const assetSlug =
      slugifyForFilename([project.name, carousel.title].filter(Boolean).join(" - ")) || "carousel";

    // Store slide images so Post to Facebook/Instagram can use them (same for PNG/JPEG/PDF).
    const paths = getExportStoragePaths(userId, carouselId, exportId);
    // Record the prefix before uploading. If a render fails partway through, the daily
    // retention job can still discover and remove any partial slide files.
    await updateExport(userId, exportId, { status: "pending", storage_path: paths.slidesDir });
    const rasterContentType = rasterFormat === "jpeg" ? "image/jpeg" : "image/png";
    // Three uploads at a time, preserving numbered filenames and waiting for each batch.
    for (let offset = 0; offset < slideBuffers.length; offset += 3) {
      const results = await Promise.allSettled(slideBuffers.slice(offset, offset + 3).map(async (buf, index) => {
        const { error } = await supabase.storage.from(BUCKET).upload(paths.slidePath(offset + index), buf, {
          contentType: rasterContentType, upsert: true,
        });
        if (error) throw new Error(error.message);
      }));
      const failed = results.find((result) => result.status === "rejected");
      if (failed?.status === "rejected") throw new Error("Failed to store slide image. Please retry.");
    }
    await updateExport(userId, exportId, { status: "ready", storage_path: paths.slidesDir });

    // Scheduling uses the same immutable raster files as a download, but does not need a ZIP.
    if (requestOptions.delivery === "schedule") {
      return NextResponse.json({ exportId });
    }

    // A direct, authenticated download URL is much more reliable on phones than
    // asking the browser to save a large Blob created by fetch().
    if (requestOptions.delivery === "prepare") {
      return NextResponse.json({
        exportId,
        downloadUrl: `/api/export/${carouselId}/${exportId}/download`,
      });
    }

    if (exportMode === "pdf") {
      const pdf = await buildCarouselPdfFromPngPages(slideBuffers, dimensions.w, dimensions.h);
      const pdfFilename = `${assetSlug}.pdf`;
      return new NextResponse(new Uint8Array(pdf), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${pdfFilename}"`,
          "X-Suggested-Filename": pdfFilename,
          "X-Export-Id": exportId,
        },
      });
    }

    const zip = new JSZip();
    for (let i = 0; i < slideBuffers.length; i++) {
      const buf = slideBuffers[i];
      if (buf) {
        const filename = `${String(i + 1).padStart(2, "0")}.${rasterFormat === "jpeg" ? "jpg" : "png"}`;
        zip.file(filename, buf);
      }
    }
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    const zipFilename = `${assetSlug}.zip`;

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipFilename}"`,
        "X-Suggested-Filename": zipFilename,
        "X-Export-Id": exportId,
      },
    });
      } catch (e) {
        lastError = e;
      } finally {
        try {
          await browser?.close();
        } catch {
          // ignore
        }
      }
      if (lastError) {
        const raw = lastError instanceof Error ? lastError.message : "";
        const isBrowserClosed =
          /Target page, context or browser has been closed/i.test(raw) ||
          /browser has been closed/i.test(raw) ||
          /Protocol error/i.test(raw);
        if (!isBrowserClosed || attempt >= MAX_EXPORT_ATTEMPTS) break;
        await new Promise((r) => setTimeout(r, 2500));
      }
    }

    if (lastError) {
      const raw = lastError instanceof Error ? lastError.message : "Export failed";
      const isBrowserClosed =
        /Target page, context or browser has been closed/i.test(raw) ||
        /browser has been closed/i.test(raw) ||
        /Protocol error/i.test(raw);
      const msg = isBrowserClosed
        ? "Export failed: the browser closed unexpectedly. Try again in a moment or download each frame individually below."
        : raw;
      try {
        await updateExport(userId, exportId, { status: "failed" });
      } catch {
        // ignore
      }
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  } catch (e) {
    const raw = e instanceof Error ? e.message : "Export failed";
    try {
      await updateExport(userId, exportId, { status: "failed" });
    } catch {
      // ignore
    }
    return NextResponse.json({ error: raw }, { status: 500 });
  }
}
