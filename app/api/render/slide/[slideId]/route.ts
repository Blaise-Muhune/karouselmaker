import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSlide, getTemplate, getCarousel, getProject, listSlides, getAsset } from "@/lib/server/db";
import { hasFullProFeatureAccess } from "@/lib/server/subscription";
import { templateConfigSchema } from "@/lib/server/renderer/templateSchema";
import { renderSlideHtml } from "@/lib/server/renderer/renderSlideHtml";
import { resolveBrandKitLogo } from "@/lib/server/brandKit";
import { buildSlideBackgroundOverrideForRasterExport } from "@/lib/server/export/buildSlideBackgroundOverride";
import { resolveImageDisplay } from "@/lib/server/export/resolveSlideBackgroundFromTemplate";
import { getSignedImageUrl } from "@/lib/server/storage/signedImageUrl";
import { httpsDisplayImageUrl } from "@/lib/server/storage/signedUrlUtils";
import type { BrandKit } from "@/lib/renderer/renderModel";

const BUCKET = "carousel-assets";
/** Match carousel page / slide editor: long enough that list iframe thumbnails stay valid. */
const DISPLAY_SIGNED_URL_EXPIRY = 3600;

function normalizeStoragePathForBucket(path: string | undefined, bucket: string): string | undefined {
  const trimmed = path?.trim().replace(/^\/+/, "");
  if (!trimmed) return undefined;
  const bucketPrefix = `${bucket}/`;
  return trimmed.startsWith(bucketPrefix) ? trimmed.slice(bucketPrefix.length) : trimmed;
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slideId: string }> }
) {
  const { slideId } = await context.params;
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

  const templateId = slide.template_id;
  if (!templateId) {
    return NextResponse.json({ error: "Slide has no template" }, { status: 400 });
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

  const project = await getProject(userId, carousel.project_id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const fullAccess = await hasFullProFeatureAccess(userId, user.email);
  const brandKit: BrandKit = await resolveBrandKitLogo(project.brand_kit as Record<string, unknown> | null);
  const carouselSlides = await listSlides(userId, slide.carousel_id);
  const totalSlides = carouselSlides.length || 1;

  const templateCfg = config.data;
  const slideBg = slide.background as
    | {
        style?: "solid" | "gradient" | "pattern";
        pattern?: "dots" | "ovals" | "lines" | "circles";
        color?: string;
        gradientOn?: boolean;
        mode?: string;
        storage_path?: string;
        asset_id?: string;
        image_url?: string;
        image_display?: { mode?: string };
        secondary_storage_path?: string;
        secondary_image_url?: string;
        images?: { image_url?: string; storage_path?: string; asset_id?: string }[];
        overlay?: {
          enabled?: boolean;
          gradient?: boolean;
          darken?: number;
          color?: string;
          textColor?: string;
          direction?: "top" | "bottom" | "left" | "right";
          extent?: number;
          solidSize?: number;
          tintColor?: string;
          tintOpacity?: number;
        };
      }
    | null
    | undefined;
  const slideMeta = (slide.meta ?? null) as Record<string, unknown> | null;
  const pictureCompositionOnly = slideMeta?.picture_composition_only === true;
  const backgroundOverride = buildSlideBackgroundOverrideForRasterExport(
    slideBg,
    templateCfg,
    slideMeta,
    true,
    pictureCompositionOnly
  );
  let backgroundImageUrl: string | null = null;
  let backgroundImageUrls: string[] | null = null;
  let secondaryBackgroundImageUrl: string | null = null;
  if (slideBg?.mode === "image") {
    if (slideBg.images?.length) {
      const urls: string[] = [];
      for (const img of slideBg.images) {
        let resolved = "";
        const path =
          normalizeStoragePathForBucket(img.storage_path, BUCKET) ||
          (img.asset_id
            ? normalizeStoragePathForBucket((await getAsset(userId, img.asset_id))?.storage_path, BUCKET)
            : undefined);
        if (path) {
          try {
            resolved = await getSignedImageUrl(BUCKET, path, DISPLAY_SIGNED_URL_EXPIRY);
          } catch {
            resolved = httpsDisplayImageUrl(img.image_url) ?? "";
          }
        } else {
          resolved = httpsDisplayImageUrl(img.image_url) ?? "";
        }
        urls.push(resolved);
      }
      const any = urls.some((u) => u.length > 0);
      if (any) {
        if (slideBg.images.length === 1) backgroundImageUrl = urls[0] ?? null;
        else backgroundImageUrls = urls;
      }
      /* `images[]` present but no slot resolved — fall through to top-level asset_id / image_url */
    }
    if (!backgroundImageUrl && !backgroundImageUrls?.length) {
      let pathToUse = normalizeStoragePathForBucket(slideBg.storage_path, BUCKET);
      if (!pathToUse && slideBg.asset_id) {
        const asset = await getAsset(userId, slideBg.asset_id);
        if (asset?.storage_path) pathToUse = normalizeStoragePathForBucket(asset.storage_path, BUCKET);
      }
      if (pathToUse) {
        try {
          backgroundImageUrl = await getSignedImageUrl(BUCKET, pathToUse, DISPLAY_SIGNED_URL_EXPIRY);
        } catch {
          backgroundImageUrl = httpsDisplayImageUrl(slideBg.image_url) ?? null;
        }
      } else {
        backgroundImageUrl = httpsDisplayImageUrl(slideBg.image_url) ?? null;
      }
    }
    if (slide.slide_type === "hook" && !backgroundImageUrls) {
      if (slideBg.secondary_storage_path) {
        try {
          const secPath = normalizeStoragePathForBucket(slideBg.secondary_storage_path, BUCKET);
          if (!secPath) throw new Error("Invalid secondary storage path");
          secondaryBackgroundImageUrl = await getSignedImageUrl(BUCKET, secPath, DISPLAY_SIGNED_URL_EXPIRY);
        } catch {
          secondaryBackgroundImageUrl = httpsDisplayImageUrl(slideBg.secondary_image_url) ?? null;
        }
      } else {
        secondaryBackgroundImageUrl = httpsDisplayImageUrl(slideBg.secondary_image_url) ?? null;
      }
    }
  }
  const borderedFrame = !!(backgroundImageUrl || backgroundImageUrls?.length);

  const defaultShowWatermark = false; // logo only when user explicitly enabled it
  const {
    normalizeSlideMetaForRender,
    getTemplateDefaultOverrides,
    mergeWithTemplateDefaults,
    getMergedImageDisplay,
    mergedHighlightStylesForSlideHtml,
  } = await import("@/lib/server/export/normalizeSlideMetaForRender");
  const normalized = normalizeSlideMetaForRender(slideMeta);
  const templateDefaults = getTemplateDefaultOverrides(config.data);
  const merged = mergeWithTemplateDefaults(normalized, templateDefaults);
  const showCounterOverride = merged.showCounterOverride;
  const showWatermarkOverride = merged.showWatermarkOverride ?? defaultShowWatermark;
  const showMadeWithOverride = merged.showMadeWithOverride ?? !fullAccess;
  const fontOverrides = merged.fontOverrides;
  const zoneOverrides = merged.zoneOverrides;
  const chromeOverrides = merged.chromeOverrides;
  const highlightStyles = mergedHighlightStylesForSlideHtml(merged);
  const imageDisplay = getMergedImageDisplay(config.data, slideBg, slideMeta);

  const carouselExportSize = (carousel as { export_size?: string }).export_size ?? "1080x1350";
  const dimensions =
    carouselExportSize === "1080x1920"
      ? { w: 1080, h: 1920 }
      : carouselExportSize === "1080x1080"
        ? { w: 1080, h: 1080 }
        : { w: 1080, h: 1350 };

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
    imageDisplay,
    dimensions,
    undefined,
    undefined,
    pictureCompositionOnly,
    undefined,
    slideMeta
  );

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
