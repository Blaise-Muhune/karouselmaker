import { NextResponse } from "next/server";
import { launchChromium } from "@/lib/server/browser/launchChromium";
import { waitForImagesInPage } from "@/lib/server/browser/waitForImages";
import { createClient } from "@/lib/supabase/server";
import {
  getCarousel,
  getProject,
  getTemplate,
  listSlides,
  createExport,
  updateExport,
  countExportsThisMonth,
  getAsset,
} from "@/lib/server/db";
import { getExportStoragePaths } from "@/lib/server/db/exports";
import { getDefaultTemplateId } from "@/lib/server/db/templates";
import { getSubscription, getEffectivePlanLimits, hasFullProFeatureAccess } from "@/lib/server/subscription";
import { templateConfigSchema } from "@/lib/server/renderer/templateSchema";
import { renderSlideHtml } from "@/lib/server/renderer/renderSlideHtml";
import { resolveBrandKitLogo } from "@/lib/server/brandKit";
import { getSignedImageUrl } from "@/lib/server/storage/signedImageUrl";
import { createProxyImageUrl } from "@/lib/server/proxyImageUrl";
import { formatUnsplashAttributionLine } from "@/lib/server/unsplash";
import {
  normalizeSlideMetaForRender,
  getTemplateDefaultOverrides,
  mergeWithTemplateDefaults,
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
/** Delay after load before screenshot so layout/fonts/images settle. Prevents pitch-black frames. */
const SCREENSHOT_DELAY_MS = 500;
/** Short pause between processing slides in production to reduce browser memory pressure and "browser closed" errors. */
const INTER_SLIDE_DELAY_MS = 150;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

async function readImageOverlayFromRequest(request: Request): Promise<boolean> {
  try {
    const ct = request.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) return true;
    const body: unknown = await request.json();
    if (body && typeof body === "object" && "image_overlay" in body) {
      const v = (body as { image_overlay?: unknown }).image_overlay;
      if (typeof v === "boolean") return v;
    }
  } catch {
    /* empty or non-JSON body */
  }
  return true;
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ carouselId: string }> }
) {
  const imageOverlay = await readImageOverlayFromRequest(_request);
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

  const { isPro } = await getSubscription(userId, user.email);
  const fullAccess = await hasFullProFeatureAccess(userId, user.email);
  const limits = await getEffectivePlanLimits(userId, user.email);
  const exportCount = await countExportsThisMonth(userId);
  if (exportCount >= limits.exportsPerMonth) {
    return NextResponse.json(
      {
        error: `Export limit: ${exportCount}/${limits.exportsPerMonth} this month.${isPro || fullAccess ? "" : " Upgrade for a higher limit."}`,
      },
      { status: 403 }
    );
  }

  const carouselExportFormat = (carousel as { export_format?: string }).export_format ?? "png";
  const carouselExportSize = (carousel as { export_size?: string }).export_size ?? "1080x1350";
  const exportMode = carouselExportFormat === "pdf" ? "pdf" : carouselExportFormat === "jpeg" ? "jpeg" : "png";
  /** Raster type for screenshots and ZIP slide files. PDF exports still render slides as PNG for quality + PDF embedding. */
  const rasterFormat = exportMode === "pdf" ? "png" : exportMode;
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

    const unsplashAttributions = new Map<
      string,
      { photographerName: string; photographerUsername: string; profileUrl: string; unsplashUrl: string }
    >();
    const pixabayAttributions = new Map<
      string,
      { userName: string; userId: number; pageURL: string; photoURL: string }
    >();
    const pexelsAttributions = new Map<
      string,
      { photographer: string; photographer_url: string; photo_url: string }
    >();

    const CONTENT_TIMEOUT_MS = 25000;
    const SELECTOR_TIMEOUT_MS = 30000;
    const MAX_EXPORT_ATTEMPTS = 3;

    let lastError: unknown = null;
    for (let attempt = 1; attempt <= MAX_EXPORT_ATTEMPTS; attempt++) {
      const browser = await launchChromium();
      try {
      for (let i = 0; i < slides.length; i++) {
        if (i > 0) {
          await new Promise((r) => setTimeout(r, INTER_SLIDE_DELAY_MS));
        }
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
        const backgroundOverride = buildSlideBackgroundOverrideForRasterExport(
          slideBg,
          templateCfg,
          slideMetaForBg,
          imageOverlay
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
                img.storage_path?.replace(/^\/+/, "").trim() ||
                (img.asset_id ? (await getAsset(userId, img.asset_id))?.storage_path?.replace(/^\/+/, "").trim() : undefined);
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
              if (img.unsplash_attribution) {
                const key = img.unsplash_attribution.photographerUsername;
                if (!unsplashAttributions.has(key)) unsplashAttributions.set(key, img.unsplash_attribution);
              }
              if (img.pixabay_attribution) {
                const key = `${img.pixabay_attribution.userName}-${img.pixabay_attribution.userId}`;
                if (!pixabayAttributions.has(key)) pixabayAttributions.set(key, img.pixabay_attribution);
              }
              if (img.pexels_attribution) {
                const key = img.pexels_attribution.photo_url;
                if (!pexelsAttributions.has(key)) pexelsAttributions.set(key, img.pexels_attribution);
              }
            }
            if (resolved.length === 1) backgroundImageUrl = resolved[0] ?? null;
            else if (resolved.length >= 2) backgroundImageUrls = resolved;
          } else {
            const storagePath = slideBg.storage_path ?? (slideBg.asset_id ? (await getAsset(userId, slideBg.asset_id))?.storage_path : undefined);
            const trimmedPath = storagePath?.replace(/^\/+/, "").trim();
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
          if (slideBg.unsplash_attribution) {
            const key = slideBg.unsplash_attribution.photographerUsername;
            if (!unsplashAttributions.has(key)) unsplashAttributions.set(key, slideBg.unsplash_attribution);
          }
          if (slideBg.pixabay_attribution) {
            const key = `${slideBg.pixabay_attribution.userName}-${slideBg.pixabay_attribution.userId}`;
            if (!pixabayAttributions.has(key)) pixabayAttributions.set(key, slideBg.pixabay_attribution);
          }
          if (slideBg.pexels_attribution) {
            const key = slideBg.pexels_attribution.photo_url;
            if (!pexelsAttributions.has(key)) pexelsAttributions.set(key, slideBg.pexels_attribution);
          }
          if (slide.slide_type === "hook" && !backgroundImageUrls) {
            if (slideBg.secondary_storage_path) {
              const secPath = slideBg.secondary_storage_path.replace(/^\/+/, "").trim();
              secondaryBackgroundImageUrl = await downloadStorageImageAsDataUrl(BUCKET, secPath);
              if (!secondaryBackgroundImageUrl) {
                try {
                  secondaryBackgroundImageUrl = await getSignedImageUrl(BUCKET, secPath, 600);
                } catch {
                  // keep null
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
        const showMadeWithOverride = merged.showMadeWithOverride ?? !fullAccess;
        const fontOverrides = merged.fontOverrides;
        const zoneOverrides = merged.zoneOverrides;
        const chromeOverrides = merged.chromeOverrides;
        const highlightStyles = merged.highlightStyles;
        const imageDisplayParam = resolveImageDisplay(config.data, slideBg, slideMeta);

        const html = renderSlideHtml(
          {
            headline: slide.headline,
            body: slide.body ?? null,
            slide_index: slide.slide_index,
            slide_type: slide.slide_type,
            ...(merged.headline_highlights?.length && { headline_highlights: merged.headline_highlights }),
            ...(merged.body_highlights?.length && { body_highlights: merged.body_highlights }),
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
          undefined,
          slideMeta
        );

        const page = await browser.newPage();
        try {
          await page.setViewportSize({ width: dimensions.w, height: dimensions.h });
          await page.setContent(html, { waitUntil: "load", timeout: CONTENT_TIMEOUT_MS });
          await page.waitForSelector(".slide-wrap", { state: "visible", timeout: SELECTOR_TIMEOUT_MS });
          await waitForImagesInPage(page, CONTENT_TIMEOUT_MS).catch(() => {});
          await new Promise((r) => setTimeout(r, SCREENSHOT_DELAY_MS));
          const buffer = await page.locator(".slide-wrap").screenshot({ type: rasterFormat, timeout: SELECTOR_TIMEOUT_MS });
          const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
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
      const captionVariants = (carousel.caption_variants ?? {}) as {
      title?: string;
      medium?: string;
      long?: string;
      short?: string;
      spicy?: string;
    };
    const hashtags = (carousel.hashtags ?? []) as string[];
    const hashtagLine =
      hashtags.length > 0
        ? hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")
        : "";
    const creditsLines: string[] = [];
    if (unsplashAttributions.size > 0) {
      creditsLines.push("Image credits (Unsplash):", ...Array.from(unsplashAttributions.values()).map(formatUnsplashAttributionLine));
    }
    if (pixabayAttributions.size > 0) {
      creditsLines.push(
        "Image credits (Pixabay):",
        ...Array.from(pixabayAttributions.values()).map(
          (a) => `Image by ${a.userName} on Pixabay — ${a.photoURL}`
        )
      );
    }
    if (pexelsAttributions.size > 0) {
      creditsLines.push(
        "Image credits (Pexels):",
        ...Array.from(pexelsAttributions.values()).map(
          (a) => `Photo by ${a.photographer} on Pexels — ${a.photo_url}`
        )
      );
    }
    const titleBlock = (captionVariants?.title ?? captionVariants?.short)?.trim();
    const mediumBlock = captionVariants?.medium?.trim();
    const longBlock = (captionVariants?.long ?? captionVariants?.spicy)?.trim();
    const captionSections: string[] = [];
    if (titleBlock) captionSections.push(`--- Title (SEO) ---\n${titleBlock}`);
    if (mediumBlock) captionSections.push(`--- Medium caption (engagement) ---\n${mediumBlock}`);
    if (longBlock) captionSections.push(`--- Long caption ---\n${longBlock}`);
    if (hashtagLine) captionSections.push(hashtagLine);
    captionSections.push(...creditsLines);
    const captionText = captionSections.filter(Boolean).join("\n\n");

    let pdfBytes: Uint8Array | null = null;
    if (exportMode === "pdf") {
      pdfBytes = await buildCarouselPdfFromPngPages(slideBuffers, dimensions.w, dimensions.h);
    }

    const zip = new JSZip();
    for (let i = 0; i < slideBuffers.length; i++) {
      const buf = slideBuffers[i];
      if (buf) {
        const filename = `${String(i + 1).padStart(2, "0")}.${rasterFormat === "jpeg" ? "jpg" : "png"}`;
        zip.file(filename, buf);
      }
    }
    if (pdfBytes) {
      zip.file("linkedin-carousel.pdf", Buffer.from(pdfBytes));
    }
    if (captionText.trim()) zip.file("caption.txt", captionText.trim());
    const hasAnyCredits = unsplashAttributions.size > 0 || pixabayAttributions.size > 0 || pexelsAttributions.size > 0;
    if (hasAnyCredits) {
      const creditsFileLines: string[] = [
        "IMAGE CREDITS",
        "-------------",
        "When publishing or distributing your carousel, you are responsible for providing proper attribution.",
        "",
      ];
      if (unsplashAttributions.size > 0) {
        creditsFileLines.push("Unsplash:", ...Array.from(unsplashAttributions.values()).map(formatUnsplashAttributionLine), "");
      }
      if (pixabayAttributions.size > 0) {
        creditsFileLines.push(
          "Pixabay:",
          ...Array.from(pixabayAttributions.values()).map((a) => `Image by ${a.userName} — ${a.photoURL}`),
          ""
        );
      }
      if (pexelsAttributions.size > 0) {
        creditsFileLines.push(
          "Pexels:",
          ...Array.from(pexelsAttributions.values()).map((a) => `Photo by ${a.photographer} — ${a.photo_url}`),
          ""
        );
      }
      zip.file("CREDITS.txt", creditsFileLines.join("\n").trim());
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

    // Store slide images so Post to Facebook/Instagram can use them
    const paths = getExportStoragePaths(userId, carouselId, exportId);
    const contentType = rasterFormat === "jpeg" ? "image/jpeg" : "image/png";
    for (let i = 0; i < slideBuffers.length; i++) {
      const buf = slideBuffers[i];
      if (buf) {
        const storagePath = paths.slidePath(i);
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, buf, { contentType, upsert: true });
        if (uploadError) {
          try {
            await updateExport(userId, exportId, { status: "failed" });
          } catch {
            // ignore
          }
          return NextResponse.json(
            { error: `Failed to store slide image: ${uploadError.message}` },
            { status: 500 }
          );
        }
      }
    }
    await updateExport(userId, exportId, { status: "ready", storage_path: paths.slidesDir });

    const zipSlug =
      slugifyForFilename([project.name, carousel.title].filter(Boolean).join(" - ")) || "carousel";
    const zipFilename = `${zipSlug}.zip`;

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
          await browser.close();
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
