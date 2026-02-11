import { NextResponse } from "next/server";
import { launchChromium } from "@/lib/server/browser/launchChromium";
import { createClient } from "@/lib/supabase/server";
import { getSlide, getTemplate, getCarousel, getProject, listSlides, listTemplatesForUser } from "@/lib/server/db";
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
  const size = (searchParams.get("size") === "1080x1080" || searchParams.get("size") === "1080x1350" || searchParams.get("size") === "1080x1920"
    ? searchParams.get("size")
    : "1080x1350") as ExportSize;

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

  const templatesList = await listTemplatesForUser(userId, { includeSystem: true });
  const defaultTemplateId = templatesList[0]?.id ?? null;
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

  const project = await getProject(userId, carousel.project_id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const { isPro } = await getSubscription(userId);
  const brandKit: BrandKit = await resolveBrandKitLogo(project.brand_kit as Record<string, unknown> | null);
  const carouselSlides = await listSlides(userId, slide.carousel_id);
  const totalSlides = carouselSlides.length || 1;

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
        images?: { image_url?: string; storage_path?: string }[];
        image_display?: Record<string, unknown>;
        overlay?: { gradient?: boolean; darken?: number; color?: string; textColor?: string; direction?: string; extent?: number; solidSize?: number };
      }
    | null
    | undefined;

  const templateCfg = config.data;
  const dir = slideBg?.overlay?.direction ?? templateCfg?.overlays?.gradient?.direction;
  const gradientDirection: "top" | "bottom" | "left" | "right" =
    dir === "top" || dir === "bottom" || dir === "left" || dir === "right" ? dir : "bottom";
  const gradientColor = slideBg?.overlay?.color ?? templateCfg?.overlays?.gradient?.color ?? "#000000";
  const templateStrength = templateCfg?.overlays?.gradient?.strength ?? 0.5;
  const gradientStrength =
    slideBg?.overlay?.darken != null && slideBg.overlay.darken !== 0.5
      ? slideBg.overlay.darken
      : templateStrength;
  const templateExtent = templateCfg?.overlays?.gradient?.extent ?? 100;
  const templateSolidSize = templateCfg?.overlays?.gradient?.solidSize ?? 0;
  const gradientExtent =
    slideBg?.overlay?.extent != null && slideBg.overlay.extent !== 100
      ? slideBg.overlay.extent
      : templateExtent;
  const gradientSolidSize =
    slideBg?.overlay?.solidSize != null && slideBg.overlay.solidSize !== 0
      ? slideBg.overlay.solidSize
      : templateSolidSize;
  const overlayFields = {
    gradientStrength,
    gradientColor,
    textColor: getContrastingTextColor(gradientColor),
    gradientDirection,
    gradientExtent,
    gradientSolidSize,
  };
  const backgroundOverride = slideBg
    ? {
        style: slideBg.style,
        color: slideBg.color,
        gradientOn: slideBg.gradientOn ?? slideBg.overlay?.gradient ?? true,
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

  const slideMeta = slide.meta as {
    show_counter?: boolean;
    show_watermark?: boolean;
    show_made_with?: boolean;
    headline_font_size?: number;
    body_font_size?: number;
    headline_zone_override?: { x?: number; y?: number; w?: number; h?: number; fontSize?: number; fontWeight?: number; lineHeight?: number; maxLines?: number; align?: "left" | "center"; color?: string };
    body_zone_override?: { x?: number; y?: number; w?: number; h?: number; fontSize?: number; fontWeight?: number; lineHeight?: number; maxLines?: number; align?: "left" | "center"; color?: string };
    headline_highlight_style?: "text" | "background";
    body_highlight_style?: "text" | "background";
  } | null;
  const showCounterOverride = slideMeta?.show_counter === true;
  const defaultShowWatermark = slide.slide_index === 1 || slide.slide_index === totalSlides;
  const showWatermarkOverride = slideMeta?.show_watermark ?? defaultShowWatermark;
  const showMadeWithOverride = slideMeta?.show_made_with ?? !isPro;
  const fontOverrides =
    slideMeta && (slideMeta.headline_font_size != null || slideMeta.body_font_size != null)
      ? { headline_font_size: slideMeta.headline_font_size, body_font_size: slideMeta.body_font_size }
      : undefined;
  const zoneOverrides =
    slideMeta && (slideMeta.headline_zone_override || slideMeta.body_zone_override)
      ? { headline: slideMeta.headline_zone_override, body: slideMeta.body_zone_override }
      : undefined;
  const highlightStyles = {
    headline: slideMeta?.headline_highlight_style === "background" ? ("background" as const) : undefined,
    body: slideMeta?.body_highlight_style === "background" ? ("background" as const) : undefined,
  };

  const dimensions = DIMENSIONS[size];
  const html = renderSlideHtml(
    {
      headline: slide.headline,
      body: slide.body ?? null,
      slide_index: slide.slide_index,
      slide_type: slide.slide_type,
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
    highlightStyles,
    borderedFrame,
    (slideBg?.image_display as Parameters<typeof renderSlideHtml>[15]) ?? undefined,
    dimensions
  );

  const browser = await launchChromium();
  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: dimensions.w, height: dimensions.h });
    await page.setContent(html, { waitUntil: "load" });
    await page.waitForSelector(".slide", { state: "visible", timeout: 15000 });
    await new Promise((r) => setTimeout(r, 300));
    const buffer = await page.screenshot({ type: format });
    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    const ext = format === "jpeg" ? "jpg" : "png";
    const filename = `slide-${slide.slide_index}.${ext}`;
    // Use application/octet-stream so iOS Safari triggers download prompt instead of opening image for preview
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } finally {
    await browser.close();
  }
}
