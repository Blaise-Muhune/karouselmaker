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
} from "@/lib/server/db";
import { getExportStoragePaths } from "@/lib/server/db/exports";
import { getDefaultTemplateId } from "@/lib/server/db/templates";
import { getSubscription, getPlanLimits } from "@/lib/server/subscription";
import { templateConfigSchema } from "@/lib/server/renderer/templateSchema";
import { renderSlideHtml } from "@/lib/server/renderer/renderSlideHtml";
import { getContrastingTextColor } from "@/lib/editor/colorUtils";
import { resolveBrandKitLogo } from "@/lib/server/brandKit";
import { getSignedImageUrl } from "@/lib/server/storage/signedImageUrl";
import { formatUnsplashAttributionLine } from "@/lib/server/unsplash";
import {
  normalizeSlideMetaForRender,
  getTemplateDefaultOverrides,
  mergeWithTemplateDefaults,
} from "@/lib/server/export/normalizeSlideMetaForRender";
import type { BrandKit } from "@/lib/renderer/renderModel";
import JSZip from "jszip";

const BUCKET = "carousel-assets";
/** Delay after load before screenshot so layout/fonts/images settle. Prevents pitch-black frames. */
const SCREENSHOT_DELAY_MS = 500;
/** Short pause between processing slides in production to reduce browser memory pressure and "browser closed" errors. */
const INTER_SLIDE_DELAY_MS = 150;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(
  _request: Request,
  context: { params: Promise<{ carouselId: string }> }
) {
  const { carouselId } = await context.params;
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const carousel = await getCarousel(userId, carouselId);
  if (!carousel) {
    return NextResponse.json({ error: "Carousel not found" }, { status: 404 });
  }

  const { isPro } = await getSubscription(userId, session.user.email);
  const limits = await getPlanLimits(userId, session.user.email);
  const exportCount = await countExportsThisMonth(userId);
  if (exportCount >= limits.exportsPerMonth) {
    return NextResponse.json(
      {
        error: `Export limit: ${exportCount}/${limits.exportsPerMonth} this month.${isPro ? "" : " Upgrade to Pro for more."}`,
      },
      { status: 403 }
    );
  }

  const carouselExportFormat = (carousel as { export_format?: string }).export_format ?? "png";
  const carouselExportSize = (carousel as { export_size?: string }).export_size ?? "1080x1350";
  const format = carouselExportFormat === "jpeg" ? "jpeg" : "png";
  const dimensions =
    carouselExportSize === "1080x1350"
      ? { w: 1080, h: 1350 }
      : carouselExportSize === "1080x1920"
        ? { w: 1080, h: 1920 }
        : { w: 1080, h: 1080 };

  let exportId: string;
  try {
    const exportRow = await createExport(userId, carouselId, format);
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
              style?: "solid" | "gradient";
              color?: string;
              gradientOn?: boolean;
              mode?: string;
              storage_path?: string;
              image_url?: string;
              secondary_storage_path?: string;
              secondary_image_url?: string;
              images?: Array<{
                image_url?: string;
                storage_path?: string;
                unsplash_attribution?: { photographerName: string; photographerUsername: string; profileUrl: string; unsplashUrl: string };
              }>;
              image_display?: Record<string, unknown>;
              overlay?: {
                gradient?: boolean;
                darken?: number;
                color?: string;
                textColor?: string;
                direction?: string;
                extent?: number;
                solidSize?: number;
              };
              unsplash_attribution?: { photographerName: string; photographerUsername: string; profileUrl: string; unsplashUrl: string };
            }
          | null
          | undefined;

        const templateCfg = config.data;
        const dir = slideBg?.overlay?.direction ?? templateCfg?.overlays?.gradient?.direction;
        const gradientDirection: "top" | "bottom" | "left" | "right" =
          dir === "top" || dir === "bottom" || dir === "left" || dir === "right" ? dir : "bottom";
        // Overlay color: slide override > template (no brand logo color; use template or neutral)
        const gradientColor =
          slideBg?.overlay?.color ??
          (templateCfg?.overlays?.gradient?.color || "#0a0a0a");
        const templateStrength = templateCfg?.overlays?.gradient?.strength ?? 0.5;
        const gradientStrength =
          slideBg?.overlay?.darken != null && slideBg.overlay.darken !== 0.5
            ? slideBg.overlay.darken
            : templateStrength;
        const templateExtent = templateCfg?.overlays?.gradient?.extent ?? 50;
        const templateSolidSize = templateCfg?.overlays?.gradient?.solidSize ?? 25;
        const gradientExtent = slideBg?.overlay?.extent != null ? slideBg.overlay.extent : templateExtent;
        const gradientSolidSize = slideBg?.overlay?.solidSize != null ? slideBg.overlay.solidSize : templateSolidSize;
        const overlayFields = {
          gradientStrength,
          gradientColor,
          textColor: getContrastingTextColor(gradientColor),
          gradientDirection,
          gradientExtent,
          gradientSolidSize,
        };
        // Match editor preview: when template defaultStyle is "none" or "blur" and slide has image, no gradient
        const hasBackgroundImage =
          slideBg?.mode === "image" &&
          (!!slideBg.images?.length || !!slideBg.image_url || !!slideBg.storage_path);
        const defaultStyle = templateCfg?.backgroundRules?.defaultStyle;
        const gradientOn =
          hasBackgroundImage && (defaultStyle === "none" || defaultStyle === "blur")
            ? false
            : (slideBg?.gradientOn ?? slideBg?.overlay?.gradient ?? true);
        const backgroundOverride = slideBg
          ? {
              style: slideBg.style,
              color: slideBg.color,
              gradientOn,
              ...overlayFields,
            }
          : undefined;

        let backgroundImageUrl: string | null = null;
        let backgroundImageUrls: string[] | null = null;
        let secondaryBackgroundImageUrl: string | null = null;
        if (slideBg?.mode === "image") {
          if (slideBg.images?.length) {
            const urls: string[] = [];
            for (const img of slideBg.images) {
              if (img.image_url) urls.push(img.image_url);
              else if (img.storage_path) {
                try {
                  urls.push(await getSignedImageUrl(BUCKET, img.storage_path, 600));
                } catch {
                  // skip
                }
              }
              if (img.unsplash_attribution) {
                const key = img.unsplash_attribution.photographerUsername;
                if (!unsplashAttributions.has(key)) {
                  unsplashAttributions.set(key, img.unsplash_attribution);
                }
              }
            }
            if (urls.length === 1) backgroundImageUrl = urls[0] ?? null;
            else if (urls.length >= 2) backgroundImageUrls = urls;
          } else if (slideBg.image_url) {
            backgroundImageUrl = slideBg.image_url;
          } else if (slideBg.storage_path) {
            try {
              backgroundImageUrl = await getSignedImageUrl(BUCKET, slideBg.storage_path, 600);
            } catch {
              // skip
            }
          }
          if (slideBg.unsplash_attribution) {
            const key = slideBg.unsplash_attribution.photographerUsername;
            if (!unsplashAttributions.has(key)) {
              unsplashAttributions.set(key, slideBg.unsplash_attribution);
            }
          }
          if (slide.slide_type === "hook" && !backgroundImageUrls) {
            if (slideBg.secondary_image_url) {
              secondaryBackgroundImageUrl = slideBg.secondary_image_url;
            } else if (slideBg.secondary_storage_path) {
              try {
                secondaryBackgroundImageUrl = await getSignedImageUrl(
                  BUCKET,
                  slideBg.secondary_storage_path,
                  600
                );
              } catch {
                // skip
              }
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
        const showMadeWithOverride = merged.showMadeWithOverride ?? !isPro;
        const fontOverrides = merged.fontOverrides;
        const zoneOverrides = merged.zoneOverrides;
        const chromeOverrides = merged.chromeOverrides;
        const highlightStyles = merged.highlightStyles;
        type ImageDisplayOption = NonNullable<Parameters<typeof renderSlideHtml>[16]>;
        const imageDisplayParam: ImageDisplayOption | undefined =
          slideBg?.image_display != null &&
          typeof slideBg.image_display === "object" &&
          !Array.isArray(slideBg.image_display)
            ? (slideBg.image_display as unknown as ImageDisplayOption)
            : undefined;

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
          borderedFrame,
          imageDisplayParam,
          dimensions
        );

        const page = await browser.newPage();
        try {
          await page.setViewportSize({ width: dimensions.w, height: dimensions.h });
          await page.setContent(html, { waitUntil: "load", timeout: CONTENT_TIMEOUT_MS });
          await page.waitForSelector(".slide-wrap", { state: "visible", timeout: SELECTOR_TIMEOUT_MS });
          await waitForImagesInPage(page, CONTENT_TIMEOUT_MS).catch(() => {});
          await new Promise((r) => setTimeout(r, SCREENSHOT_DELAY_MS));
          const buffer = await page.locator(".slide-wrap").screenshot({ type: format, timeout: SELECTOR_TIMEOUT_MS });
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
      short?: string;
      medium?: string;
      spicy?: string;
    };
    const hashtags = (carousel.hashtags ?? []) as string[];
    const hashtagLine =
      hashtags.length > 0
        ? hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")
        : "";
    const creditsLines =
      unsplashAttributions.size > 0
        ? [
            "Image credits (Unsplash):",
            ...Array.from(unsplashAttributions.values()).map(formatUnsplashAttributionLine),
          ]
        : [];
    const shortBlock = captionVariants?.short?.trim();
    const mediumBlock = captionVariants?.medium?.trim();
    const longBlock = captionVariants?.spicy?.trim();
    const captionSections: string[] = [];
    if (shortBlock) captionSections.push(`--- Short ---\n${shortBlock}`);
    if (mediumBlock) captionSections.push(`--- Medium ---\n${mediumBlock}`);
    if (longBlock) captionSections.push(`--- Long ---\n${longBlock}`);
    if (hashtagLine) captionSections.push(hashtagLine);
    captionSections.push(...creditsLines);
    const captionText = captionSections.filter(Boolean).join("\n\n");

    const zip = new JSZip();
    for (let i = 0; i < slideBuffers.length; i++) {
      const buf = slideBuffers[i];
      if (buf) {
        const filename = `${String(i + 1).padStart(2, "0")}.${format === "jpeg" ? "jpg" : "png"}`;
        zip.file(filename, buf);
      }
    }
    if (captionText.trim()) zip.file("caption.txt", captionText.trim());
    if (unsplashAttributions.size > 0) {
      const creditsFileLines = [
        "IMAGE CREDITS (Unsplash)",
        "-----------------------",
        "When publishing or distributing your carousel, you are responsible for providing proper attribution to photographers.",
        "",
        ...Array.from(unsplashAttributions.values()).map(formatUnsplashAttributionLine),
      ];
      zip.file("CREDITS.txt", creditsFileLines.join("\n"));
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

    // Store slide images so Post to Facebook/Instagram can use them
    const paths = getExportStoragePaths(userId, carouselId, exportId);
    const contentType = format === "jpeg" ? "image/jpeg" : "image/png";
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

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="carousel.zip"',
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
        ? "Export failed: the browser closed unexpectedly. Try again in a moment or download each slide individually below."
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
