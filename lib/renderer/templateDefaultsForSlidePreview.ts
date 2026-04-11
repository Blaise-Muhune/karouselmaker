import type { SlidePreviewProps } from "@/components/renderer/SlidePreview";
import { getTemplateDefaultOverrides } from "@/lib/server/export/normalizeSlideMetaForRender";
import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";

/**
 * Props to spread on `SlidePreview` so template picker / thumb match editor export:
 * zone + font + chrome from `defaults.meta`, plus outline strokes and highlight style.
 */
export function getSlidePreviewSpreadFromTemplateConfig(
  config: TemplateConfig
): Pick<
  SlidePreviewProps,
  | "zoneOverrides"
  | "fontOverrides"
  | "chromeOverrides"
  | "headlineHighlightStyle"
  | "bodyHighlightStyle"
  | "headlineOutlineStroke"
  | "bodyOutlineStroke"
  | "headlineBoldWeight"
  | "bodyBoldWeight"
> {
  const norm = getTemplateDefaultOverrides(config);
  const hl = norm.highlightStyles;
  const outline = norm.outlineStrokes;
  const bold = norm.boldWeights;

  const spread: Pick<
    SlidePreviewProps,
    | "zoneOverrides"
    | "fontOverrides"
    | "chromeOverrides"
    | "headlineHighlightStyle"
    | "bodyHighlightStyle"
    | "headlineOutlineStroke"
    | "bodyOutlineStroke"
    | "headlineBoldWeight"
    | "bodyBoldWeight"
  > = {
    zoneOverrides: norm.zoneOverrides,
    fontOverrides: norm.fontOverrides,
    chromeOverrides: norm.chromeOverrides,
    headlineHighlightStyle: hl?.headline === "background" ? "background" : "text",
    bodyHighlightStyle: hl?.body === "background" ? "background" : "text",
    headlineOutlineStroke: outline?.headline ?? 0,
    bodyOutlineStroke: outline?.body ?? 0,
  };

  if (bold?.headline != null) spread.headlineBoldWeight = bold.headline;
  if (bold?.body != null) spread.bodyBoldWeight = bold.body;

  return spread;
}
