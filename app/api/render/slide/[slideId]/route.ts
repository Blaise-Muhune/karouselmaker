import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSlide, getTemplate, getCarousel, getProject, listSlides } from "@/lib/server/db";
import { getSubscription } from "@/lib/server/subscription";
import { templateConfigSchema } from "@/lib/server/renderer/templateSchema";
import { renderSlideHtml } from "@/lib/server/renderer/renderSlideHtml";
import { getContrastingTextColor } from "@/lib/editor/colorUtils";
import { resolveBrandKitLogo } from "@/lib/server/brandKit";
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
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

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

  const { isPro } = await getSubscription(userId, session.user.email);
  const brandKit: BrandKit = await resolveBrandKitLogo(project.brand_kit as Record<string, unknown> | null);
  const carouselSlides = await listSlides(userId, slide.carousel_id);
  const totalSlides = carouselSlides.length || 1;

  const templateCfg = config.data;
  const slideBg = slide.background as
    | { style?: "solid" | "gradient"; color?: string; gradientOn?: boolean; mode?: string; storage_path?: string; image_url?: string; secondary_storage_path?: string; secondary_image_url?: string; images?: { image_url?: string; storage_path?: string }[]; overlay?: { gradient?: boolean; darken?: number; color?: string; textColor?: string; direction?: "top" | "bottom" | "left" | "right"; extent?: number; solidSize?: number } }
    | null
    | undefined;
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
    gradientDirection: (slideBg?.overlay?.direction ?? templateCfg?.overlays?.gradient?.direction ?? "bottom") as "top" | "bottom" | "left" | "right",
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

  const slideMeta = (slide.meta ?? null) as Record<string, unknown> | null;
  const defaultShowWatermark = false; // logo only when user explicitly enabled it
  const { normalizeSlideMetaForRender } = await import("@/lib/server/export/normalizeSlideMetaForRender");
  const normalized = normalizeSlideMetaForRender(slideMeta);
  const showCounterOverride = normalized.showCounterOverride;
  const showWatermarkOverride = normalized.showWatermarkOverride ?? defaultShowWatermark;
  const showMadeWithOverride = normalized.showMadeWithOverride ?? !isPro;
  const fontOverrides = normalized.fontOverrides;
  const zoneOverrides = normalized.zoneOverrides;
  const chromeOverrides = normalized.chromeOverrides;
  const highlightStyles = normalized.highlightStyles;

  const html = renderSlideHtml(
    {
      headline: slide.headline,
      body: slide.body ?? null,
      slide_index: slide.slide_index,
      slide_type: slide.slide_type,
    ...(normalized.headline_highlights?.length && { headline_highlights: normalized.headline_highlights }),
    ...(normalized.body_highlights?.length && { body_highlights: normalized.body_highlights }),
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
    borderedFrame
  );

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
