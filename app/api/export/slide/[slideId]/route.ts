import { NextResponse } from "next/server";
import { launchChromium } from "@/lib/server/browser/launchChromium";
import { waitForImagesInPage } from "@/lib/server/browser/waitForImages";
import { createClient } from "@/lib/supabase/server";
import { getSlide, getTemplate, getCarousel, getProject, listSlides, getAsset } from "@/lib/server/db";
import { getDefaultTemplateId } from "@/lib/server/db/templates";
import { hasFullProFeatureAccess } from "@/lib/server/subscription";
import { templateConfigSchema } from "@/lib/server/renderer/templateSchema";
import { renderSlideHtml } from "@/lib/server/renderer/renderSlideHtml";
import { buildSlideBackgroundOverrideForRasterExport } from "@/lib/server/export/buildSlideBackgroundOverride";
import { resolveBrandKitLogo } from "@/lib/server/brandKit";
import {
  normalizeSlideMetaForRender,
  getTemplateDefaultOverrides,
  mergeWithTemplateDefaults,
} from "@/lib/server/export/normalizeSlideMetaForRender";
import { resolveImageDisplay } from "@/lib/server/export/resolveSlideBackgroundFromTemplate";
import {
  downloadStorageImageAsDataUrl,
  fetchImageAsDataUrl,
} from "@/lib/server/export/fetchImageAsDataUrl";
import { getSignedImageUrl } from "@/lib/server/storage/signedImageUrl";
import { createProxyImageUrl } from "@/lib/server/proxyImageUrl";
import type { BrandKit } from "@/lib/renderer/renderModel";
import { slugifyForFilename } from "@/lib/utils";

const BUCKET = "carousel-assets";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeStoragePathForBucket(path: string | undefined, bucket: string): string | undefined {
  const trimmed = path?.trim().replace(/^\/+/, "");
  if (!trimmed) return undefined;
  const bucketPrefix = `${bucket}/`;
  return trimmed.startsWith(bucketPrefix) ? trimmed.slice(bucketPrefix.length) : trimmed;
}

type ExportFormat = "png" | "jpeg";
type ExportSize = "1080x1080" | "1080x1350" | "1080x1920";

const DIMENSIONS: Record<ExportSize, { w: number; h: number }> = {
  "1080x1080": { w: 1080, h: 1080 },
  "1080x1350": { w: 1080, h: 1350 },
  "1080x1920": { w: 1080, h: 1920 },
};

export async function GET(
  request: Request,
  context: { params: Promise<{ slideId: string }> }
) {
  const { slideId } = await context.params;
  const { searchParams } = new URL(request.url);
  const format = (searchParams.get("format") === "jpeg" ? "jpeg" : "png") as ExportFormat;
  const imageOverlay = searchParams.get("image_overlay") !== "0";
  const sizeParam = searchParams.get("size");
  const sizeFromParam =
    sizeParam === "1080x1080" || sizeParam === "1080x1350" || sizeParam === "1080x1920"
      ? (sizeParam as ExportSize)
      : null;

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = user.id;

  const slide = await getSlide(userId, slideId);
  if (!slide) {
    return NextResponse.json({ error: "Slide not found" }, { status: 404 });
  }

  const defaultTemplateId = await getDefaultTemplateId(userId);
  const templateId = slide.template_id ?? defaultTemplateId;
  if (!templateId) {
    return NextResponse.json({ error: "Slide has no template and no templates available" }, { status: 400 });
  }

  const template = await getTemplate(userId, templateId);
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const config = templateConfigSchema.safeParse(template.config);
  if (!config.success) {
    return NextResponse.json({ error: "Invalid template config" }, { status: 400 });
  }

  const carousel = await getCarousel(userId, slide.carousel_id);
  if (!carousel) {
    return NextResponse.json({ error: "Carousel not found" }, { status: 404 });
  }

  const carouselExportSize = (carousel as { export_size?: string }).export_size;
  const size: ExportSize =
    sizeFromParam ??
    (carouselExportSize === "1080x1080" || carouselExportSize === "1080x1350" || carouselExportSize === "1080x1920"
      ? (carouselExportSize as ExportSize)
      : "1080x1350");

  const project = await getProject(userId, carousel.project_id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const fullAccess = await hasFullProFeatureAccess(userId, user.email);
  const brandKit: BrandKit = await resolveBrandKitLogo(project.brand_kit as Record<string, unknown> | null);
  const carouselSlides = await listSlides(userId, slide.carousel_id);
  const totalSlides = carouselSlides.length || 1;

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
        images?: { image_url?: string; storage_path?: string; asset_id?: string }[];
        image_display?: Record<string, unknown>;
        overlay?: { enabled?: boolean; gradient?: boolean; darken?: number; color?: string; textColor?: string; direction?: string; extent?: number; solidSize?: number; tintColor?: string; tintOpacity?: number };
      }
    | null
    | undefined;

  const slideMeta = (slide.meta ?? null) as Record<string, unknown> | null;
  const templateCfg = config.data;
  const pictureCompositionOnly = slideMeta?.picture_composition_only === true;
  const backgroundOverride = buildSlideBackgroundOverrideForRasterExport(
    slideBg,
    templateCfg,
    slideMeta,
    imageOverlay,
    pictureCompositionOnly
  );

  let backgroundImageUrl: string | null = null;
  let backgroundImageUrls: string[] | null = null;
  let secondaryBackgroundImageUrl: string | null = null;
  const appOrigin = new URL(request.url).origin;
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
        // Fallback: use raw URL so export HTML still has a loadable image (Puppeteer can load it)
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
        if (!secPath) {
          secondaryBackgroundImageUrl = null;
        } else {
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
  const borderedFrame = !!(backgroundImageUrl || backgroundImageUrls?.length);

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

  const dimensions = DIMENSIONS[size];
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
    totalSlides,
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

  const browser = await launchChromium();
  const CONTENT_TIMEOUT_MS = 25000;
  const SELECTOR_TIMEOUT_MS = 30000;
  try {
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: dimensions.w, height: dimensions.h });
      await page.setContent(html, { waitUntil: "load", timeout: CONTENT_TIMEOUT_MS });
      await page.waitForSelector(".slide-wrap", { state: "visible", timeout: SELECTOR_TIMEOUT_MS });
      await waitForImagesInPage(page, CONTENT_TIMEOUT_MS).catch(() => {});
      await new Promise((r) => setTimeout(r, 1200));
      const buffer = await page.locator(".slide-wrap").screenshot({ type: format, timeout: SELECTOR_TIMEOUT_MS });
      const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
      const ext = format === "jpeg" ? "jpg" : "png";
      const slug =
        slugifyForFilename([project.name, carousel.title].filter(Boolean).join(" - ")) || "slide";
      const filename = `${slug}-${String(slide.slide_index).padStart(2, "0")}.${ext}`;
      return new NextResponse(new Uint8Array(buf), {
        status: 200,
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    } finally {
      await page.close();
    }
  } catch (e) {
    const raw = e instanceof Error ? e.message : "Export failed";
    const isBrowserClosed =
      /Target page, context or browser has been closed/i.test(raw) ||
      /browser has been closed/i.test(raw) ||
      /Protocol error/i.test(raw);
    const msg = isBrowserClosed
      ? "Download failed: the browser closed unexpectedly. Try again in a moment."
      : raw;
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    await browser.close();
  }
}
