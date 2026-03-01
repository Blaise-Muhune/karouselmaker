/**
 * Render carousel slides to storage for video generation only (no export row, no zip).
 * Video generation can call this so it does not depend on running Export first.
 */
import { NextResponse } from "next/server";
import { launchChromium } from "@/lib/server/browser/launchChromium";
import { createClient } from "@/lib/supabase/server";
import {
  getCarousel,
  getProject,
  getTemplate,
  listSlides,
} from "@/lib/server/db";
import { getDefaultTemplateId } from "@/lib/server/db/templates";
import { getSubscription } from "@/lib/server/subscription";
import { getVideoRenderStoragePaths } from "@/lib/server/db/exports";
import { templateConfigSchema } from "@/lib/server/renderer/templateSchema";
import { renderSlideHtml } from "@/lib/server/renderer/renderSlideHtml";
import { getContrastingTextColor } from "@/lib/editor/colorUtils";
import { resolveBrandKitLogo } from "@/lib/server/brandKit";
import { getSignedImageUrl } from "@/lib/server/storage/signedImageUrl";
import {
  normalizeSlideMetaForRender,
  getTemplateDefaultOverrides,
  mergeWithTemplateDefaults,
} from "@/lib/server/export/normalizeSlideMetaForRender";
import { resolveSlideBackgroundUrls } from "@/lib/server/export/resolveSlideBackgroundUrls";
import {
  isExternalImageUrl,
  materializeImageUrl,
} from "@/lib/server/export/materializeImageUrl";
import type { BrandKit } from "@/lib/renderer/renderModel";

const BUCKET = "carousel-assets";
const VIDEO_ASSET_EXPIRES = 600;
const SCREENSHOT_DELAY_MS = 200;
const INTER_SLIDE_DELAY_MS = 150;
const CONTENT_TIMEOUT_MS = 25000;
const SELECTOR_TIMEOUT_MS = 30000;
const SIGNED_URL_EXPIRES = 600;

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
  const project = await getProject(userId, carousel.project_id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const brandKit: BrandKit = await resolveBrandKitLogo(
    project.brand_kit as Record<string, unknown> | null
  );
  const slides = await listSlides(userId, carouselId);
  if (slides.length === 0) {
    return NextResponse.json({ error: "Carousel has no slides" }, { status: 400 });
  }

  const defaultTemplateId = await getDefaultTemplateId(userId);
  const runId = crypto.randomUUID();
  const paths = getVideoRenderStoragePaths(userId, carouselId, runId);

  const carouselExportSize = (carousel as { export_size?: string }).export_size ?? "1080x1350";
  const dimensions =
    carouselExportSize === "1080x1350"
      ? { w: 1080, h: 1350 }
      : carouselExportSize === "1080x1920"
        ? { w: 1080, h: 1920 }
        : { w: 1080, h: 1080 };
  const format = "png";

  const backgroundData = await resolveSlideBackgroundUrls(slides);
  const resolvedVideoUrls: string[][] = [];
  for (let i = 0; i < slides.length; i++) {
    const raw = backgroundData[i]!.backgroundUrls;
    const urls: string[] = [];
    for (let bgIdx = 0; bgIdx < raw.length; bgIdx++) {
      const u = raw[bgIdx]!;
      if (isExternalImageUrl(u)) {
        const signed = await materializeImageUrl(
          u,
          null,
          paths.videoBgPath(i, bgIdx),
          VIDEO_ASSET_EXPIRES
        );
        if (signed) urls.push(signed);
      } else {
        urls.push(u);
      }
    }
    resolvedVideoUrls.push(urls.length > 0 ? urls : []);
  }

  const browser = await launchChromium();
  try {
    for (let i = 0; i < slides.length; i++) {
      if (i > 0) {
        await new Promise((r) => setTimeout(r, INTER_SLIDE_DELAY_MS));
      }
      const slide = slides[i]!;
      const templateId = slide.template_id ?? defaultTemplateId;
      if (!templateId) {
        throw new Error(`Slide ${slide.slide_index + 1} has no template`);
      }
      const template = await getTemplate(userId, templateId);
      if (!template) {
        throw new Error(`Template not found for slide ${slide.slide_index + 1}`);
      }
      const config = templateConfigSchema.safeParse(template.config);
      if (!config.success) {
        throw new Error(`Invalid template config for slide ${slide.slide_index + 1}`);
      }

      const slideBg = slide.background as
        | {
            style?: string;
            color?: string;
            gradientOn?: boolean;
            mode?: string;
            images?: Array<{ image_url?: string; storage_path?: string }>;
            image_url?: string;
            storage_path?: string;
            secondary_image_url?: string;
            secondary_storage_path?: string;
            overlay?: { direction?: string; color?: string; darken?: number; extent?: number; solidSize?: number; gradient?: boolean };
            image_display?: Record<string, unknown>;
          }
        | null
        | undefined;

      const templateCfg = config.data;
      const dir = slideBg?.overlay?.direction ?? templateCfg?.overlays?.gradient?.direction;
      const gradientDirection: "top" | "bottom" | "left" | "right" =
        dir === "top" || dir === "bottom" || dir === "left" || dir === "right" ? dir : "bottom";
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
            style: (slideBg.style === "solid" || slideBg.style === "gradient" ? slideBg.style : undefined) as "solid" | "gradient" | undefined,
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
      const normalized = normalizeSlideMetaForRender(slideMeta);
      const templateDefaults = getTemplateDefaultOverrides(config.data);
      const merged = mergeWithTemplateDefaults(normalized, templateDefaults);
      const defaultShowWatermark = false;
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
        await new Promise((r) => setTimeout(r, SCREENSHOT_DELAY_MS));
        const buffer = await page.locator(".slide-wrap").screenshot({ type: format, timeout: SELECTOR_TIMEOUT_MS });
        const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(paths.slidePath(i), buf, { contentType: "image/png", upsert: true });
        if (uploadError) throw new Error(`Upload slide ${i + 1} failed: ${uploadError.message}`);
        await page.setContent("about:blank", { waitUntil: "domcontentloaded" });

        const overlayHtml = renderSlideHtml(
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
          undefined,
          undefined,
          undefined,
          showCounterOverride,
          showWatermarkOverride,
          showMadeWithOverride,
          fontOverrides,
          zoneOverrides,
          chromeOverrides,
          highlightStyles,
          borderedFrame,
          imageDisplayParam,
          dimensions,
          true
        );
        await page.setContent(overlayHtml, { waitUntil: "load", timeout: CONTENT_TIMEOUT_MS });
        await page.waitForSelector(".slide-wrap", { state: "visible", timeout: SELECTOR_TIMEOUT_MS });
        await new Promise((r) => setTimeout(r, SCREENSHOT_DELAY_MS));
        const overlayBuffer = await page.locator(".slide-wrap").screenshot({ type: "png", timeout: SELECTOR_TIMEOUT_MS });
        const overlayBuf = Buffer.isBuffer(overlayBuffer) ? overlayBuffer : Buffer.from(overlayBuffer);
        const { error: overlayUploadError } = await supabase.storage
          .from(BUCKET)
          .upload(paths.overlayPath(i), overlayBuf, { contentType: "image/png", upsert: true });
        if (overlayUploadError) throw new Error(`Upload overlay ${i + 1} failed: ${overlayUploadError.message}`);
        await page.setContent("about:blank", { waitUntil: "domcontentloaded" });

        const variants = resolvedVideoUrls[i] ?? [];
        for (let v = 0; v < variants.length; v++) {
          const singleBgUrl = variants[v]!;
          const variantHtml = renderSlideHtml(
            {
              headline: "",
              body: null,
              slide_index: slide.slide_index,
              slide_type: slide.slide_type,
            },
            config.data,
            brandKit,
            slides.length,
            backgroundOverride,
            singleBgUrl,
            null,
            null,
            false,
            false,
            false,
            fontOverrides,
            zoneOverrides,
            chromeOverrides,
            highlightStyles,
            borderedFrame,
            imageDisplayParam,
            dimensions,
            undefined,
            true
          );
          await page.setContent(variantHtml, { waitUntil: "load", timeout: CONTENT_TIMEOUT_MS });
          await page.waitForSelector(".slide-wrap", { state: "visible", timeout: SELECTOR_TIMEOUT_MS });
          await new Promise((r) => setTimeout(r, SCREENSHOT_DELAY_MS));
          const variantBuffer = await page.locator(".slide-wrap").screenshot({ type: "png", timeout: SELECTOR_TIMEOUT_MS });
          const variantBuf = Buffer.isBuffer(variantBuffer) ? variantBuffer : Buffer.from(variantBuffer);
          const { error: variantUploadError } = await supabase.storage
            .from(BUCKET)
            .upload(paths.videoSlidePath(i, v), variantBuf, { contentType: "image/png", upsert: true });
          if (variantUploadError) throw new Error(`Upload video variant ${i + 1}-${v + 1} failed: ${variantUploadError.message}`);
          await page.setContent("about:blank", { waitUntil: "domcontentloaded" });
        }
      } finally {
        try {
          await page.close();
        } catch {
          // ignore
        }
      }
    }

    const slideUrls = await Promise.all(
      slides.map((_, i) => getSignedImageUrl(BUCKET, paths.slidePath(i), SIGNED_URL_EXPIRES))
    );
    const slideVideoData = slides.map((_, i) => {
      const variantCount = resolvedVideoUrls[i]?.length ?? 0;
      const backgroundUrls =
        variantCount > 0
          ? Array.from({ length: variantCount }, (_, v) =>
              `/api/carousel/${carouselId}/video-render/${runId}/video-slide/${i}/${v}`
            )
          : [slideUrls[i]!];
      return {
        backgroundUrls,
        overlayUrl: null as string | null,
      };
    });

    return NextResponse.json({
      runId,
      slideUrls,
      slideVideoData,
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : "Render for video failed";
    return NextResponse.json({ error: raw }, { status: 500 });
  } finally {
    try {
      await browser.close();
    } catch {
      // ignore
    }
  }
}
