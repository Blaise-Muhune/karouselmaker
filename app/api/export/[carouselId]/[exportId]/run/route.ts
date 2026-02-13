import { NextResponse } from "next/server";
import { launchChromium } from "@/lib/server/browser/launchChromium";
import JSZip from "jszip";
import { createClient } from "@/lib/supabase/server";
import { getSubscription } from "@/lib/server/subscription";
import {
  getCarousel,
  getProject,
  listSlides,
  getTemplate,
  getExport,
  updateExport,
  getExportStoragePaths,
} from "@/lib/server/db";
import { getContrastingTextColor } from "@/lib/editor/colorUtils";
import { resolveBrandKitLogo } from "@/lib/server/brandKit";
import { formatUnsplashAttributionLine } from "@/lib/server/unsplash";
import { templateConfigSchema } from "@/lib/server/renderer/templateSchema";
import { renderSlideHtml, type SlideBackgroundOverride, type GradientDirection } from "@/lib/server/renderer/renderSlideHtml";
import { getSignedImageUrl } from "@/lib/server/storage/signedImageUrl";
import type { BrandKit, TextZoneOverrides } from "@/lib/renderer/renderModel";

const BUCKET = "carousel-assets";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** Runs the export work in the background (no client connection held). */
export async function POST(
  _request: Request,
  context: { params: Promise<{ carouselId: string; exportId: string }> }
) {
  const { carouselId, exportId } = await context.params;
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

  const exportRow = await getExport(userId, exportId);
  if (!exportRow || exportRow.carousel_id !== carouselId) {
    return NextResponse.json({ error: "Export not found" }, { status: 404 });
  }
  if (exportRow.status !== "pending") {
    return NextResponse.json({ error: "Export already processed" }, { status: 400 });
  }

  const { isPro } = await getSubscription(userId, session.user.email);
  const format = exportRow.format === "jpeg" ? "jpeg" : "png";
  const dimensions =
    (carousel as { export_size?: string }).export_size === "1080x1920"
      ? { w: 1080, h: 1920 }
      : (carousel as { export_size?: string }).export_size === "1080x1080"
        ? { w: 1080, h: 1080 }
        : { w: 1080, h: 1350 };

  try {
    const project = await getProject(userId, carousel.project_id);
    if (!project) throw new Error("Project not found");
    const brandKit: BrandKit = await resolveBrandKitLogo(project.brand_kit as Record<string, unknown> | null);

    const slides = await listSlides(userId, carouselId);
    if (slides.length === 0) throw new Error("No slides to export");

    const { getDefaultTemplateId } = await import("@/lib/server/db/templates");
    const defaultTemplateId = await getDefaultTemplateId(userId);

    const paths = getExportStoragePaths(userId, carouselId, exportId);
    const browser = await launchChromium();
    const zip = new JSZip();
    const pngBuffers: Buffer[] = [];
    const unsplashAttributions = new Map<
      string,
      { photographerName: string; photographerUsername: string; profileUrl: string; unsplashUrl: string }
    >();

    try {
      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];
        if (!slide) continue;
        const templateId = slide.template_id ?? defaultTemplateId;
        if (!templateId) throw new Error(`Slide ${i + 1} has no template`);
        const template = await getTemplate(userId, templateId);
        if (!template) throw new Error(`Template not found for slide ${i + 1}`);
        const config = templateConfigSchema.safeParse(template.config);
        if (!config.success) throw new Error(`Invalid template config for slide ${i + 1}`);

        const templateCfg = config.data;
        const slideBg = slide.background as Record<string, unknown> | null | undefined;
        const gradientColor = (slideBg?.overlay as { color?: string })?.color ?? (templateCfg?.overlays?.gradient as { color?: string })?.color ?? "#000000";
        const templateStrength = (templateCfg?.overlays?.gradient as { strength?: number })?.strength ?? 0.5;
        const gradientStrength = (slideBg?.overlay as { darken?: number })?.darken != null && (slideBg?.overlay as { darken?: number }).darken !== 0.5 ? (slideBg?.overlay as { darken?: number }).darken! : templateStrength;
        const templateExtent = (templateCfg?.overlays?.gradient as { extent?: number })?.extent ?? 100;
        const templateSolidSize = (templateCfg?.overlays?.gradient as { solidSize?: number })?.solidSize ?? 0;
        const gradientExtent = (slideBg?.overlay as { extent?: number })?.extent != null && (slideBg?.overlay as { extent?: number }).extent !== 100 ? (slideBg?.overlay as { extent?: number }).extent! : templateExtent;
        const gradientSolidSize = (slideBg?.overlay as { solidSize?: number })?.solidSize != null && (slideBg?.overlay as { solidSize?: number }).solidSize !== 0 ? (slideBg?.overlay as { solidSize?: number }).solidSize! : templateSolidSize;
        const rawDirection = (slideBg?.overlay as { direction?: string })?.direction ?? (templateCfg?.overlays?.gradient as { direction?: string })?.direction ?? "bottom";
        const gradientDirection: GradientDirection = (rawDirection === "top" || rawDirection === "bottom" || rawDirection === "left" || rawDirection === "right") ? rawDirection : "bottom";
        const overlayFields = {
          gradientStrength,
          gradientColor,
          textColor: getContrastingTextColor(gradientColor),
          gradientDirection,
          gradientExtent,
          gradientSolidSize,
        };
        const rawGradientOn = slideBg?.gradientOn ?? (slideBg?.overlay as { gradient?: boolean })?.gradient ?? true;
        const backgroundOverride: SlideBackgroundOverride | undefined = slideBg
          ? {
              style: slideBg.style === "solid" || slideBg.style === "gradient" ? slideBg.style : undefined,
              color: typeof slideBg.color === "string" ? slideBg.color : undefined,
              gradientOn: typeof rawGradientOn === "boolean" ? rawGradientOn : true,
              ...overlayFields,
            }
          : undefined;

        let backgroundImageUrl: string | null = null;
        let backgroundImageUrls: string[] | null = null;
        let secondaryBackgroundImageUrl: string | null = null;
        if (slideBg?.mode === "image") {
          const images = slideBg.images as Array<{ image_url?: string; storage_path?: string }> | undefined;
          if (images?.length) {
            const urls: string[] = [];
            for (const img of images) {
              if (img.image_url) urls.push(img.image_url);
              else if (img.storage_path) {
                try {
                  urls.push(await getSignedImageUrl(BUCKET, img.storage_path, 300));
                } catch {
                  // skip
                }
              }
            }
            if (urls.length === 1) backgroundImageUrl = urls[0] ?? null;
            else if (urls.length >= 2) backgroundImageUrls = urls;
          } else if (slideBg.image_url) {
            backgroundImageUrl = slideBg.image_url as string;
          } else if (slideBg.storage_path) {
            try {
              backgroundImageUrl = await getSignedImageUrl(BUCKET, slideBg.storage_path as string, 300);
            } catch {
              // skip
            }
          }
          if (slide.slide_type === "hook" && !backgroundImageUrls) {
            if (slideBg.secondary_image_url) secondaryBackgroundImageUrl = slideBg.secondary_image_url as string;
            else if (slideBg.secondary_storage_path) {
              try {
                secondaryBackgroundImageUrl = await getSignedImageUrl(BUCKET, slideBg.secondary_storage_path as string, 300);
              } catch {
                // skip
              }
            }
          }
        }
        const borderedFrame = !!(backgroundImageUrl || (backgroundImageUrls?.length ?? 0));

        const unsplashAttr = slideBg?.unsplash_attribution as { photographerUsername: string; photographerName: string; profileUrl: string; unsplashUrl: string } | undefined;
        if (unsplashAttr) {
          if (!unsplashAttributions.has(unsplashAttr.photographerUsername)) unsplashAttributions.set(unsplashAttr.photographerUsername, unsplashAttr);
        }
        const imgs = (slideBg?.images as Array<{ unsplash_attribution?: { photographerUsername: string; photographerName: string; profileUrl: string; unsplashUrl: string } }>) ?? [];
        for (const img of imgs) {
          if (img.unsplash_attribution && !unsplashAttributions.has(img.unsplash_attribution.photographerUsername)) {
            unsplashAttributions.set(img.unsplash_attribution.photographerUsername, img.unsplash_attribution);
          }
        }

        const slideMeta = slide.meta as Record<string, unknown> | null;
        const showCounterOverride = slideMeta?.show_counter === true;
        const defaultShowWatermark = slide.slide_index === 1 || slide.slide_index === slides.length;
        const showWatermarkOverride: boolean = slideMeta?.show_watermark === true || slideMeta?.show_watermark === false ? (slideMeta.show_watermark as boolean) : defaultShowWatermark;
        const showMadeWithOverride: boolean = slideMeta?.show_made_with === true || slideMeta?.show_made_with === false ? (slideMeta.show_made_with as boolean) : !isPro;
        const fontOverrides = slideMeta && (slideMeta.headline_font_size != null || slideMeta.body_font_size != null) ? { headline_font_size: slideMeta.headline_font_size as number, body_font_size: slideMeta.body_font_size as number } : undefined;
        const zoneOverrides: TextZoneOverrides | undefined = slideMeta && (slideMeta.headline_zone_override || slideMeta.body_zone_override) ? { headline: slideMeta.headline_zone_override as TextZoneOverrides["headline"], body: slideMeta.body_zone_override as TextZoneOverrides["body"] } : undefined;
        const highlightStyles = { headline: slideMeta?.headline_highlight_style === "background" ? "background" as const : undefined, body: slideMeta?.body_highlight_style === "background" ? "background" as const : undefined };

        const html = renderSlideHtml(
          { headline: slide.headline, body: slide.body ?? null, slide_index: slide.slide_index, slide_type: slide.slide_type },
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
          highlightStyles,
          borderedFrame,
          (slideBg?.image_display as Parameters<typeof renderSlideHtml>[15]) ?? undefined,
          dimensions
        );

        const page = await browser.newPage();
        try {
          await page.setViewportSize({ width: dimensions.w, height: dimensions.h });
          await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 15000 });
          await page.waitForSelector(".slide", { state: "visible", timeout: 15000 });
          await new Promise((r) => setTimeout(r, 400));
          const buffer = await page.screenshot({ type: "png" });
          const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
          pngBuffers.push(buf);
          const slidePath = paths.slidePath(i);
          const { error: uploadError } = await supabase.storage.from(BUCKET).upload(slidePath, buf, { contentType: "image/png", upsert: true });
          if (uploadError) throw new Error(`Upload slide failed: ${uploadError.message}`);
        } finally {
          await page.close();
        }
      }
    } finally {
      await browser.close();
    }

    const ext = format === "jpeg" ? "jpg" : "png";
    const filename = (i: number) => `${String(i + 1).padStart(2, "0")}.${ext}`;
    pngBuffers.forEach((buf, i) => zip.file(filename(i), buf));

    const captionVariants = (carousel as { caption_variants?: { short?: string; medium?: string; spicy?: string } }).caption_variants;
    const hashtags = (carousel as { hashtags?: string[] }).hashtags ?? [];
    const captionLine = captionVariants?.medium ?? captionVariants?.short ?? captionVariants?.spicy ?? "";
    const hashtagLine = hashtags.length > 0 ? hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ") : "";
    const creditsLines = unsplashAttributions.size > 0 ? ["Image credits (Unsplash):", ...Array.from(unsplashAttributions.values()).map(formatUnsplashAttributionLine)] : [];
    const captionText = [captionLine, hashtagLine, ...creditsLines].filter(Boolean).join("\n\n");
    if (captionText.trim()) zip.file("caption.txt", captionText.trim());
    if (unsplashAttributions.size > 0) {
      zip.file("CREDITS.txt", ["IMAGE CREDITS (Unsplash)", "-----------------------", "When publishing or distributing your carousel, you are responsible for providing proper attribution to photographers.", "", ...Array.from(unsplashAttributions.values()).map(formatUnsplashAttributionLine)].join("\n"));
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    const { error: zipUploadError } = await supabase.storage.from(BUCKET).upload(paths.zipPath, zipBuffer, { contentType: "application/zip", upsert: true });
    if (zipUploadError) throw new Error(`Upload ZIP failed: ${zipUploadError.message}`);

    await updateExport(userId, exportId, { status: "ready", storage_path: paths.zipPath });
    return new NextResponse(null, { status: 200 });
  } catch (e) {
    try {
      await updateExport(userId, exportId, { status: "failed" });
    } catch {
      // ignore
    }
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
