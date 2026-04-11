import { renderSlideHtml, type HighlightStyleOverrides } from "@/lib/server/renderer/renderSlideHtml";
import { launchChromium } from "@/lib/server/browser/launchChromium";
import { waitForImagesInPage } from "@/lib/server/browser/waitForImages";
import { getTemplatePreviewBackgroundOverride, getTemplatePreviewOverlayOverride } from "@/lib/renderer/getTemplatePreviewBackground";
import {
  getImportPreviewDerived,
  getImageDisplayFromConfig,
  IMPORT_PREVIEW_UNSPLASH_URLS,
} from "@/lib/templates/importPreviewDerived";
import { resolveImageDisplay } from "@/lib/server/export/resolveSlideBackgroundFromTemplate";
import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";
import type { BrandKit, ChromeOverrides } from "@/lib/renderer/renderModel";

const DIM = { w: 1080, h: 1350 };
const CONTENT_TIMEOUT_MS = 25_000;
const SELECTOR_TIMEOUT_MS = 30_000;

function buildImportChromeOverrides(config: TemplateConfig, chromeOverridesFromMeta: ChromeOverrides | undefined): ChromeOverrides {
  const base = chromeOverridesFromMeta ?? {};
  if (config.chrome?.showSwipe) {
    return {
      ...base,
      showSwipe: true,
      swipeSize:
        config.chrome.swipeSize ??
        (["arrow-right", "arrow-left", "arrows"].includes(config.chrome.swipeType ?? "") ? 40 : undefined),
    };
  }
  return { ...base, showSwipe: false };
}

/**
 * Renders the same 4:5 preview the import dialog shows, screenshots `.slide-wrap`, returns PNG bytes.
 * Used for a second vision pass that compares reference vs rendered output.
 */
export async function captureImportTemplatePreviewPng(config: TemplateConfig): Promise<Buffer | null> {
  const previewDerived = getImportPreviewDerived(config);
  const imageDisplay = getImageDisplayFromConfig(config);
  const metaForPreview =
    config.defaults?.meta && typeof config.defaults.meta === "object" ? (config.defaults.meta as Record<string, unknown>) : undefined;
  const madeWithText = typeof metaForPreview?.made_with_text === "string" ? metaForPreview.made_with_text.trim() : "";
  const suppressProjectWatermark = madeWithText.length > 0;
  const bgHex =
    typeof metaForPreview?.background_color === "string" && /^#([0-9A-Fa-f]{3}){1,2}$/.test(metaForPreview.background_color)
      ? metaForPreview.background_color
      : "#0a0a0a";

  const isMultiImageLayout = imageDisplay?.layout && ["side-by-side", "stacked", "grid"].includes(imageDisplay.layout);
  const isSolidOnlyDesign =
    config.defaults?.background &&
    typeof config.defaults.background === "object" &&
    (config.defaults.background as { style?: string }).style === "solid" &&
    imageDisplay?.mode !== "pip" &&
    imageDisplay?.mode !== "full";
  const templateHasNoImage = config.backgroundRules?.allowImage === false || isSolidOnlyDesign;

  const brandKit: BrandKit = {
    primary_color: bgHex,
    watermark_text: suppressProjectWatermark
      ? undefined
      : config.chrome?.watermark?.enabled
        ? "Your handle"
        : undefined,
  };

  const chromeOverrides = buildImportChromeOverrides(config, previewDerived.chromeOverridesFromMeta);
  const highlightStyles: HighlightStyleOverrides = {
    ...(previewDerived.headlineHighlightStyle === "background" && { headline: "background" }),
    ...(previewDerived.bodyHighlightStyle === "background" && { body: "background" }),
  };

  const imageDisplayParam = resolveImageDisplay(config, null, config.defaults?.meta ?? undefined);

  const html = renderSlideHtml(
    {
      ...previewDerived.slide,
      ...(previewDerived.headline_highlights?.length && { headline_highlights: previewDerived.headline_highlights }),
      ...(previewDerived.body_highlights?.length && { body_highlights: previewDerived.body_highlights }),
    },
    config,
    brandKit,
    previewDerived.totalSlides,
    templateHasNoImage
      ? getTemplatePreviewBackgroundOverride(config)
      : (getTemplatePreviewOverlayOverride(config) ?? getTemplatePreviewBackgroundOverride(config)),
    templateHasNoImage ? undefined : !isMultiImageLayout ? IMPORT_PREVIEW_UNSPLASH_URLS[0] : undefined,
    templateHasNoImage ? undefined : isMultiImageLayout ? [...IMPORT_PREVIEW_UNSPLASH_URLS.slice(0, 3)] : undefined,
    undefined,
    config.chrome?.showCounter,
    suppressProjectWatermark ? false : (config.chrome?.watermark?.enabled ?? false),
    metaForPreview && typeof metaForPreview.show_made_with === "boolean" ? metaForPreview.show_made_with : undefined,
    previewDerived.fontOverrides,
    previewDerived.zoneOverrides,
    chromeOverrides,
    highlightStyles,
    previewDerived.headlineOutlineStroke != null || previewDerived.bodyOutlineStroke != null
      ? {
          ...(previewDerived.headlineOutlineStroke != null && { headline: previewDerived.headlineOutlineStroke }),
          ...(previewDerived.bodyOutlineStroke != null && { body: previewDerived.bodyOutlineStroke }),
        }
      : undefined,
    undefined,
    undefined,
    undefined,
    !templateHasNoImage,
    imageDisplayParam,
    DIM,
    undefined,
    undefined,
    undefined,
    undefined,
    config.defaults?.meta ?? null
  );

  let browser: Awaited<ReturnType<typeof launchChromium>> | null = null;
  try {
    browser = await launchChromium();
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: DIM.w, height: DIM.h });
      await page.setContent(html, { waitUntil: "load", timeout: CONTENT_TIMEOUT_MS });
      await page.waitForSelector(".slide-wrap", { state: "visible", timeout: SELECTOR_TIMEOUT_MS });
      await waitForImagesInPage(page, CONTENT_TIMEOUT_MS).catch(() => {});
      await new Promise((r) => setTimeout(r, 800));
      const buffer = await page.locator(".slide-wrap").screenshot({ type: "png", timeout: SELECTOR_TIMEOUT_MS });
      return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    } finally {
      await page.close();
    }
  } catch (e) {
    console.warn("[import-template] Preview screenshot failed:", e instanceof Error ? e.message : e);
    return null;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
