import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSlide, getTemplate, getCarousel, getProject, listSlides } from "@/lib/server/db";
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

  const brandKit: BrandKit = await resolveBrandKitLogo(project.brand_kit as Record<string, unknown> | null);
  const carouselSlides = await listSlides(userId, slide.carousel_id);
  const totalSlides = carouselSlides.length || 1;

  const slideBg = slide.background as
    | { style?: "solid" | "gradient"; color?: string; gradientOn?: boolean; mode?: string; storage_path?: string; image_url?: string; secondary_storage_path?: string; secondary_image_url?: string; images?: { image_url?: string; storage_path?: string }[]; overlay?: { gradient?: boolean; darken?: number; color?: string; textColor?: string; direction?: "top" | "bottom" | "left" | "right" } }
    | null
    | undefined;
  const gradientColor = slideBg?.overlay?.color ?? "#000000";
  const overlayFields = {
    gradientStrength: slideBg?.overlay?.darken ?? 0.5,
    gradientColor,
    textColor: getContrastingTextColor(gradientColor),
    gradientDirection: slideBg?.overlay?.direction ?? "bottom",
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

  const slideMeta = slide.meta as { show_counter?: boolean; show_watermark?: boolean; headline_font_size?: number; body_font_size?: number; headline_highlight_style?: "text" | "background"; body_highlight_style?: "text" | "background" } | null;
  const showCounterOverride = slideMeta?.show_counter === true;
  const defaultShowWatermark = slide.slide_index === 1 || slide.slide_index === totalSlides;
  const showWatermarkOverride = slideMeta?.show_watermark ?? defaultShowWatermark;
  const fontOverrides =
    slideMeta && (slideMeta.headline_font_size != null || slideMeta.body_font_size != null)
      ? { headline_font_size: slideMeta.headline_font_size, body_font_size: slideMeta.body_font_size }
      : undefined;
  const highlightStyles = {
    headline: slideMeta?.headline_highlight_style === "background" ? "background" as const : undefined,
    body: slideMeta?.body_highlight_style === "background" ? "background" as const : undefined,
  };

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
    fontOverrides,
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
