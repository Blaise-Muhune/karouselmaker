import { NextResponse } from "next/server";
import { launchChromium } from "@/lib/server/browser/launchChromium";
import JSZip from "jszip";
import { createClient } from "@/lib/supabase/server";
import { getSubscription } from "@/lib/server/subscription";
import { PLAN_LIMITS } from "@/lib/constants";
import {
  getCarousel,
  getProject,
  listSlides,
  getTemplate,
  createExport,
  updateExport,
  getExportStoragePaths,
  countExportsThisMonth,
} from "@/lib/server/db";
import { getContrastingTextColor } from "@/lib/editor/colorUtils";
import { resolveBrandKitLogo } from "@/lib/server/brandKit";
import { formatUnsplashAttributionLine } from "@/lib/server/unsplash";
import { templateConfigSchema } from "@/lib/server/renderer/templateSchema";
import { renderSlideHtml } from "@/lib/server/renderer/renderSlideHtml";
import { getSignedDownloadUrl } from "@/lib/server/storage/signedUrl";
import { getSignedImageUrl } from "@/lib/server/storage/signedImageUrl";
import type { BrandKit } from "@/lib/renderer/renderModel";

const BUCKET = "carousel-assets";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

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

  const { isPro } = await getSubscription(userId);
  const exportCount = await countExportsThisMonth(userId);
  const limit = isPro ? PLAN_LIMITS.pro.exportsPerMonth : PLAN_LIMITS.free.exportsPerMonth;
  if (exportCount >= limit) {
    return NextResponse.json(
      { error: `Export limit: ${exportCount}/${limit} this month.${isPro ? "" : " Upgrade to Pro for more."}` },
      { status: 403 }
    );
  }

  const carouselExportFormat = (carousel as { export_format?: string }).export_format ?? "png";
  const carouselExportSize = (carousel as { export_size?: string }).export_size ?? "1080x1350";
  const format = carouselExportFormat === "jpeg" ? "jpeg" : "png";
  const dimensions = carouselExportSize === "1080x1350"
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
    if (!project) throw new Error("Project not found");
    const brandKit: BrandKit = await resolveBrandKitLogo(project.brand_kit as Record<string, unknown> | null);

    const slides = await listSlides(userId, carouselId);
    if (slides.length === 0) throw new Error("No slides to export");

    const { listTemplatesForUser } = await import("@/lib/server/db");
    const templatesList = await listTemplatesForUser(userId, { includeSystem: true });
    const defaultTemplateId = templatesList[0]?.id ?? null;

    const paths = getExportStoragePaths(userId, carouselId, exportId);
    const browser = await launchChromium();
    let page: Awaited<ReturnType<typeof browser.newPage>>;
    try {
      page = await browser.newPage();
    } catch (e) {
      await browser.close();
      throw e;
    }
    await page.setViewportSize({ width: dimensions.w, height: dimensions.h });

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
      const slideBg = slide.background as
        | { style?: "solid" | "gradient"; color?: string; gradientOn?: boolean; mode?: string; storage_path?: string; image_url?: string; image_source?: string; unsplash_attribution?: { photographerName: string; photographerUsername: string; profileUrl: string; unsplashUrl: string }; secondary_storage_path?: string; secondary_image_url?: string; images?: { image_url?: string; storage_path?: string; source?: string; unsplash_attribution?: { photographerName: string; photographerUsername: string; profileUrl: string; unsplashUrl: string } }[]; image_display?: { position?: string; fit?: "cover" | "contain"; frame?: "none" | "thin" | "medium" | "thick"; frameRadius?: number; frameColor?: string; layout?: string; gap?: number }; overlay?: { gradient?: boolean; darken?: number; color?: string; textColor?: string; direction?: "top" | "bottom" | "left" | "right"; extent?: number; solidSize?: number } }
        | null
        | undefined;
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
        gradientDirection: slideBg?.overlay?.direction ?? templateCfg?.overlays?.gradient?.direction ?? "bottom",
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
                urls.push(await getSignedImageUrl(BUCKET, img.storage_path, 300));
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
            backgroundImageUrl = await getSignedImageUrl(BUCKET, slideBg.storage_path, 300);
          } catch {
            // skip
          }
        }
        if (slide.slide_type === "hook" && !backgroundImageUrls) {
          if (slideBg.secondary_image_url) {
            secondaryBackgroundImageUrl = slideBg.secondary_image_url;
          } else if (slideBg.secondary_storage_path) {
            try {
              secondaryBackgroundImageUrl = await getSignedImageUrl(BUCKET, slideBg.secondary_storage_path, 300);
            } catch {
              // skip
            }
          }
        }
      }
      const borderedFrame = !!(backgroundImageUrl || backgroundImageUrls?.length);

      // Collect Unsplash attributions for CREDITS.txt and caption
      if (slideBg?.unsplash_attribution) {
        const key = slideBg.unsplash_attribution.photographerUsername;
        if (!unsplashAttributions.has(key)) {
          unsplashAttributions.set(key, slideBg.unsplash_attribution);
        }
      }
      if (slideBg?.images?.length) {
        for (const img of slideBg.images) {
          if (img.unsplash_attribution) {
            const key = img.unsplash_attribution.photographerUsername;
            if (!unsplashAttributions.has(key)) {
              unsplashAttributions.set(key, img.unsplash_attribution);
            }
          }
        }
      }

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
      const defaultShowWatermark = slide.slide_index === 1 || slide.slide_index === slides.length;
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

      await page.setContent(html, { waitUntil: "load" });
      await page.waitForSelector(".slide", { state: "visible", timeout: 15000 });
      await new Promise((r) => setTimeout(r, 300));
      const buffer = await page.screenshot({ type: "png" });
      const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
      pngBuffers.push(buf);

      const slidePath = paths.slidePath(i);
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(slidePath, buf, { contentType: "image/png", upsert: true });
      if (uploadError) throw new Error(`Upload slide failed: ${uploadError.message}`);
    }
    } finally {
      await browser.close();
    }

    const ext = format === "jpeg" ? "jpg" : "png";
    const filename = (i: number) => `${String(i + 1).padStart(2, "0")}.${ext}`;
    pngBuffers.forEach((buf, i) => zip.file(filename(i), buf));

    const captionVariants = carousel.caption_variants as
      | { short?: string; medium?: string; spicy?: string }
      | undefined;
    const hashtags = (carousel.hashtags ?? []) as string[];
    const captionLine =
      captionVariants?.medium ?? captionVariants?.short ?? captionVariants?.spicy ?? "";
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
    const captionParts = [captionLine, hashtagLine, ...creditsLines].filter(Boolean);
    const captionText = captionParts.join("\n\n");
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
    const { error: zipUploadError } = await supabase.storage
      .from(BUCKET)
      .upload(paths.zipPath, zipBuffer, { contentType: "application/zip", upsert: true });
    if (zipUploadError) throw new Error(`Upload ZIP failed: ${zipUploadError.message}`);

    await updateExport(userId, exportId, { status: "ready", storage_path: paths.zipPath });

    const downloadUrl = await getSignedDownloadUrl(BUCKET, paths.zipPath, 600);

    return NextResponse.json({
      exportId,
      status: "ready",
      downloadUrl,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Export failed";
    try {
      await updateExport(userId, exportId, { status: "failed" });
    } catch {
      // ignore
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
