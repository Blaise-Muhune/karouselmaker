import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSlide, getTemplate, getCarousel, getProject, listSlides } from "@/lib/server/db";
import { getSubscription } from "@/lib/server/subscription";
import { templateConfigSchema } from "@/lib/server/renderer/templateSchema";
import { renderSlideHtml } from "@/lib/server/renderer/renderSlideHtml";
import { getContrastingTextColor } from "@/lib/editor/colorUtils";
import { getTemplatePreviewBackgroundOverride } from "@/lib/renderer/getTemplatePreviewBackground";
import { resolveBrandKitLogo } from "@/lib/server/brandKit";
import {
  resolveOverlayTint,
  resolveBackgroundColorFromMeta,
  resolveImageDisplay,
  resolveOverlayEnabled,
} from "@/lib/server/export/resolveSlideBackgroundFromTemplate";
import { getSignedImageUrl } from "@/lib/server/storage/signedImageUrl";
import type { BrandKit } from "@/lib/renderer/renderModel";

const BUCKET = "carousel-assets";

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

  const { isPro } = await getSubscription(userId, user.email);
  const brandKit: BrandKit = await resolveBrandKitLogo(project.brand_kit as Record<string, unknown> | null);
  const carouselSlides = await listSlides(userId, slide.carousel_id);
  const totalSlides = carouselSlides.length || 1;

  const templateCfg = config.data;
  const slideBg = slide.background as
    | { style?: "solid" | "gradient" | "pattern"; pattern?: "dots" | "ovals" | "lines" | "circles"; color?: string; gradientOn?: boolean; mode?: string; storage_path?: string; image_url?: string; image_display?: { mode?: string }; secondary_storage_path?: string; secondary_image_url?: string; images?: { image_url?: string; storage_path?: string }[]; overlay?: { enabled?: boolean; gradient?: boolean; darken?: number; color?: string; textColor?: string; direction?: "top" | "bottom" | "left" | "right"; extent?: number; solidSize?: number; tintColor?: string; tintOpacity?: number } }
    | null
    | undefined;
  const slideMeta = (slide.meta ?? null) as Record<string, unknown> | null;
  const imageDisplayMerged = resolveImageDisplay(templateCfg, slideBg);
  const isPip = imageDisplayMerged?.mode === "pip";
  const { tintOpacity: effectiveTintOpacity, tintColor: effectiveTintColor } = resolveOverlayTint(
    slideBg,
    slideMeta,
    templateCfg,
    isPip
  );
  const overlayEnabled = resolveOverlayEnabled(slideBg);
  const metaBgColor = resolveBackgroundColorFromMeta(slideMeta, templateCfg);
  const templateDefaultColor =
    (templateCfg?.defaults?.background as { color?: string } | undefined)?.color ?? metaBgColor ?? "#0a0a0a";

  const gradientColor =
    slideBg?.overlay?.color ?? (templateCfg?.overlays?.gradient?.color || "#0a0a0a");
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
    gradientDirection: (slideBg?.overlay?.direction ?? templateCfg?.overlays?.gradient?.direction ?? "bottom") as "top" | "bottom" | "left" | "right",
    gradientExtent,
    gradientSolidSize,
    overlayEnabled,
    ...(effectiveTintOpacity > 0 ? { tintColor: effectiveTintColor, tintOpacity: effectiveTintOpacity } : {}),
  };
  const hasBackgroundImage =
    slideBg?.mode === "image" &&
    (!!slideBg.images?.length || !!slideBg.image_url || !!slideBg.storage_path);
  const defaultStyle = templateCfg?.backgroundRules?.defaultStyle;
  /** Only gate by overlay when there is a background image (overlay on picture). Solid/pattern background is unchanged. */
  const gradientOn = hasBackgroundImage
    ? overlayEnabled && (defaultStyle !== "none" && defaultStyle !== "blur") && (slideBg?.gradientOn ?? slideBg?.overlay?.gradient ?? true)
    : (slideBg?.gradientOn ?? slideBg?.overlay?.gradient ?? true);
  const templateBg = getTemplatePreviewBackgroundOverride(templateCfg);
  const effectiveStyle =
    !hasBackgroundImage ? (slideBg?.style ?? templateBg.style ?? "solid") : slideBg?.style;
  const effectivePattern =
    !hasBackgroundImage && effectiveStyle === "pattern"
      ? (slideBg?.pattern ?? templateBg.pattern)
      : slideBg?.pattern;
  const effectiveColorRaw = !hasBackgroundImage ? (slideBg?.color ?? templateBg.color ?? metaBgColor) : (slideBg?.color ?? templateBg.color ?? metaBgColor);
  const effectiveColor = /^#([0-9A-Fa-f]{3}){1,2}$/.test(effectiveColorRaw ?? "") ? effectiveColorRaw! : "#0a0a0a";
  const effectiveDecoration = !hasBackgroundImage ? templateBg.decoration : undefined;
  const effectiveDecorationColor = !hasBackgroundImage ? templateBg.decorationColor : undefined;
  const backgroundOverride = slideBg
    ? {
        style: effectiveStyle,
        pattern: effectivePattern,
        color: effectiveColor as string,
        ...(effectiveDecoration && { decoration: effectiveDecoration, ...(effectiveDecorationColor && { decorationColor: effectiveDecorationColor }) }),
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
          secondaryBackgroundImageUrl = await getSignedImageUrl(BUCKET, slideBg.secondary_storage_path, 600);
        } catch {
          // skip
        }
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
  } = await import("@/lib/server/export/normalizeSlideMetaForRender");
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
  const imageDisplay = getMergedImageDisplay(config.data, slideBg);

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
    borderedFrame,
    imageDisplay,
    dimensions
  );

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
