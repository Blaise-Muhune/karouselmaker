/**
 * Parse hex color to r, g, b (0-255). Supports #rgb and #rrggbb.
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace(/^#/, "");
  if (clean.length === 3) {
    const r = parseInt(clean.charAt(0) + clean.charAt(0), 16);
    const g = parseInt(clean.charAt(1) + clean.charAt(1), 16);
    const b = parseInt(clean.charAt(2) + clean.charAt(2), 16);
    return { r, g, b };
  }
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

/**
 * Return rgba(r, g, b, opacity) string for gradient overlay.
 */
export function hexToRgba(hex: string, opacity: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${opacity})`;
}

/**
 * Return white or dark text color for good contrast against the given background.
 * Uses relative luminance: dark backgrounds → white text, light backgrounds → dark text.
 */
export function getContrastingTextColor(backgroundColor: string): string {
  const hex = (backgroundColor || "#000000").replace(/^#/, "");
  if (!/^([0-9A-Fa-f]{3}){1,2}$/.test(hex)) return "#ffffff";
  const { r, g, b } = hexToRgb(backgroundColor);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#111111" : "#ffffff";
}
