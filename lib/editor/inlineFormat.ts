/**
 * Inline formatting in slide text for bold and highlight color.
 * - **bold** → bold text
 * - {{yellow}}word{{/}} or {{#facc15}}word{{/}} → colored/highlight text (good contrast on dark bg)
 */

export type InlineSegment = {
  type: "normal" | "bold" | "color";
  text: string;
  color?: string;
};

/** Preset highlight colors with good contrast on dark backgrounds */
export const HIGHLIGHT_COLORS: Record<string, string> = {
  yellow: "#facc15",
  amber: "#fbbf24",
  orange: "#fb923c",
  lime: "#a3e635",
  green: "#4ade80",
  cyan: "#22d3ee",
  sky: "#38bdf8",
  pink: "#f472b6",
  rose: "#fb7185",
  white: "#ffffff",
};

/**
 * Parse a line of slide text for **bold** and {{name}}text{{/}} or {{#hex}}text{{/}}.
 * Unclosed {{name}} or {{#hex}} colors the rest of the line (no literal tag shown).
 * Returns segments in order for rendering.
 */
export function parseInlineFormatting(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  // Normalize *** to ** (bold uses exactly two asterisks)
  let remaining = text.replace(/\*\*\*/g, "**");

  while (remaining.length > 0) {
    // Try {{color}}content{{/}} or {{#hex}}content{{/}}
    const colorMatch = remaining.match(/\{\{(#[\da-fA-F]{6}|[a-z]+)\}\}([\s\S]+?)\{\{\/\}\}/);
    // Try **bold**
    const boldMatch = remaining.match(/\*\*([\s\S]+?)\*\*/);
    // Unclosed {{color}} or {{#hex}} — color rest of line
    const unclosedMatch = remaining.match(/\{\{(#[\da-fA-F]{6}|[a-z]+)\}\}([\s\S]*)/);

    const colorIndex = colorMatch ? remaining.indexOf(colorMatch[0]) : -1;
    const boldIndex = boldMatch ? remaining.indexOf(boldMatch[0]) : -1;
    const unclosedIndex = unclosedMatch ? remaining.indexOf(unclosedMatch[0]) : -1;

    // Pick the first match
    if (colorIndex >= 0 && (boldIndex < 0 || colorIndex <= boldIndex)) {
      const match = colorMatch!;
      const before = remaining.slice(0, colorIndex);
      if (before) segments.push({ type: "normal", text: before });
      const colorKey = match[1] ?? "";
      const colorHex = colorKey.startsWith("#") ? colorKey : HIGHLIGHT_COLORS[colorKey] ?? "#facc15";
      segments.push({ type: "color", text: match[2] ?? "", color: colorHex });
      remaining = remaining.slice(colorIndex + match[0].length);
    } else if (boldIndex >= 0 && (unclosedIndex < 0 || boldIndex <= unclosedIndex)) {
      const match = boldMatch!;
      const before = remaining.slice(0, boldIndex);
      if (before) segments.push({ type: "normal", text: before });
      segments.push({ type: "bold", text: match[1] ?? "" });
      remaining = remaining.slice(boldIndex + match[0].length);
    } else if (unclosedIndex >= 0) {
      const match = unclosedMatch!;
      const before = remaining.slice(0, unclosedIndex);
      if (before) segments.push({ type: "normal", text: before });
      const colorKey = match[1] ?? "";
      const colorHex = colorKey.startsWith("#") ? colorKey : HIGHLIGHT_COLORS[colorKey] ?? "#facc15";
      const rest = match[2] ?? "";
      if (rest) segments.push({ type: "color", text: rest, color: colorHex });
      break;
    } else {
      segments.push({ type: "normal", text: remaining });
      break;
    }
  }

  return segments;
}

export type HighlightSpan = { start: number; end: number; color: string };

/**
 * Inject {{#hex}}...{{/}} into plain text from stored highlight spans.
 * Spans are clamped to text length; overlapping spans are merged (last wins for overlap).
 * Use this when headline/body are stored without brackets and highlights are in meta.
 */
/**
 * Remove {{name}}, {{#hex}}, and {{/}} from text, leaving only the inner content.
 * Use when loading text that has brackets but we now store highlights in spans.
 */
export function stripHighlightMarkers(text: string): string {
  return text
    .replace(/\{\{(?:#[\da-fA-F]{6}|[a-z]+)\}\}/g, "")
    .replace(/\{\{\/\}\}/g, "");
}

export function injectHighlightMarkers(text: string, spans: HighlightSpan[]): string {
  if (!spans.length) return text;
  const len = text.length;
  const clamped = spans
    .map((s) => ({ start: Math.max(0, Math.min(s.start, len)), end: Math.max(0, Math.min(s.end, len)), color: s.color }))
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start - b.start);
  if (!clamped.length) return text;
  let out = "";
  let lastEnd = 0;
  for (const s of clamped) {
    const start = Math.max(s.start, lastEnd);
    if (start >= s.end) continue;
    if (start > lastEnd) out += text.slice(lastEnd, start);
    const hex = s.color.startsWith("#") ? s.color : `#${s.color}`;
    out += `{{${hex}}}${text.slice(start, s.end)}{{/}}`;
    lastEnd = s.end;
  }
  if (lastEnd < len) out += text.slice(lastEnd, len);
  return out;
}
