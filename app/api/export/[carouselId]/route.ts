import { NextResponse } from "next/server";
import { chromium } from "playwright";
import JSZip from "jszip";
import { createClient } from "@/lib/supabase/server";
import {
  getCarousel,
  getProject,
  listSlides,
  getTemplate,
  createExport,
  updateExport,
  getExportStoragePaths,
} from "@/lib/server/db";
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

  let exportId: string;
  try {
    const exportRow = await createExport(userId, carouselId, "png");
    exportId = exportRow.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create export";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  try {
    const project = await getProject(userId, carousel.project_id);
    if (!project) throw new Error("Project not found");
    const brandKit: BrandKit = (project.brand_kit as BrandKit) ?? {};

    const slides = await listSlides(userId, carouselId);
    if (slides.length === 0) throw new Error("No slides to export");

    const { listTemplatesForUser } = await import("@/lib/server/db");
    const templatesList = await listTemplatesForUser(userId, { includeSystem: true });
    const defaultTemplateId = templatesList[0]?.id ?? null;

    const paths = getExportStoragePaths(userId, carouselId, exportId);
    const browser = await chromium.launch({ headless: true });
    let page: Awaited<ReturnType<typeof browser.newPage>>;
    try {
      page = await browser.newPage();
    } catch (e) {
      await browser.close();
      throw e;
    }
    await page.setViewportSize({ width: 1080, height: 1080 });

    const zip = new JSZip();
    const pngBuffers: Buffer[] = [];

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

      const slideBg = slide.background as
        | { style?: "solid" | "gradient"; color?: string; gradientOn?: boolean; mode?: string; storage_path?: string; image_url?: string; secondary_storage_path?: string; secondary_image_url?: string; images?: { image_url?: string; storage_path?: string }[]; image_display?: { position?: string; fit?: "cover" | "contain"; frame?: "none" | "thin" | "medium" | "thick"; frameRadius?: number; frameColor?: string; layout?: string; gap?: number }; overlay?: { gradient?: boolean; darken?: number; color?: string; textColor?: string; direction?: "top" | "bottom" | "left" | "right" } }
        | null
        | undefined;
      const overlayFields = {
        gradientStrength: slideBg?.overlay?.darken ?? 0.5,
        gradientColor: slideBg?.overlay?.color ?? "#000000",
        textColor: slideBg?.overlay?.textColor ?? "#ffffff",
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

      const slideMeta = slide.meta as { show_counter?: boolean; headline_font_size?: number; body_font_size?: number; headline_highlight_style?: "text" | "background"; body_highlight_style?: "text" | "background" } | null;
      const showCounterOverride = slideMeta?.show_counter === true;
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
        slides.length,
        backgroundOverride,
        backgroundImageUrl,
        backgroundImageUrls,
        secondaryBackgroundImageUrl,
        showCounterOverride,
        fontOverrides,
        highlightStyles,
        borderedFrame,
        (slideBg?.image_display as Parameters<typeof renderSlideHtml>[12]) ?? undefined
      );

      await page.setContent(html, { waitUntil: "networkidle" });
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

    const filename = (i: number) => `${String(i + 1).padStart(2, "0")}.png`;
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
    const captionText = [captionLine, hashtagLine].filter(Boolean).join("\n\n");
    if (captionText.trim()) zip.file("caption.txt", captionText.trim());

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
