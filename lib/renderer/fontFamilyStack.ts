/**
 * Shared CSS font-family stacks for preview + export.
 * Keep SlidePreview, FontPickerModal, and renderSlideHtml on the same stacks.
 */
export function getFontFamilyStack(fontFamily: string | undefined | null): string {
  const f = fontFamily?.trim() || "system";
  if (f === "system" || f === "sans-serif") {
    // Prefer Inter as the consistent webfont so Mac preview and Linux Chromium export match.
    // Fallbacks cover cases where Inter has not loaded yet.
    return '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  }
  if (f === "Inter") return '"Inter", system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
  if (f === "Georgia" || f === "serif") return 'Georgia, "Times New Roman", Times, serif';
  if (f === "Times New Roman") return '"Times New Roman", Times, Georgia, serif';
  if (f === "Roboto") return '"Roboto", system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
  if (f === "Montserrat") return '"Montserrat", system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
  if (f === "Open Sans") return '"Open Sans", system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
  if (f === "Lato") return '"Lato", system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
  if (f === "Poppins") return '"Poppins", system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
  if (f === "Work Sans") return '"Work Sans", system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
  if (f === "Playfair Display") return '"Playfair Display", Georgia, serif';
  if (f === "Merriweather") return '"Merriweather", Georgia, serif';
  if (f === "Libre Baskerville") return '"Libre Baskerville", Georgia, serif';
  if (f === "Source Sans 3") return '"Source Sans 3", system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
  if (f === "Chonburi") return '"Chonburi", Georgia, serif';
  if (f === "Instrument Serif") return '"Instrument Serif", Georgia, serif';
  if (f === "Bodoni Moda") return '"Bodoni Moda", Georgia, serif';
  if (f === "Prata") return '"Prata", Georgia, serif';
  if (f === "Arapey") return '"Arapey", Georgia, serif';
  if (f === "Fraunces") return '"Fraunces", Georgia, serif';
  if (f === "Abril Fatface") return '"Abril Fatface", Georgia, serif';
  if (f === "Limelight") return '"Limelight", system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
  if (f === "Syne") return '"Syne", system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
  if (f === "Outfit") return '"Outfit", system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
  if (f === "Urbanist") return '"Urbanist", system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
  if (f === "Sora") return '"Sora", system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
  // Unknown id: quote as-is (may be a loaded Google font or OS font).
  const safe = f.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${safe}", system-ui, -apple-system, BlinkMacSystemFont, sans-serif`;
}

/** Escape quotes for embedding inside an HTML style="" attribute. */
export function getFontFamilyStackForHtmlAttr(fontFamily: string | undefined | null): string {
  return getFontFamilyStack(fontFamily).replace(/"/g, "&quot;");
}
