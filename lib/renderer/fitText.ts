import type { TextZone } from "@/lib/server/renderer/templateSchema";

/**
 * Approximate chars per line from zone width and font size (rough: ~0.6em per char).
 * Used to cap text before fitting into maxLines.
 */
function charsPerLine(zone: TextZone): number {
  const approxCharWidth = zone.fontSize * 0.55;
  return Math.max(1, Math.floor(zone.w / approxCharWidth));
}

/** True if string is a complete {{name}}content{{/}} or {{#hex}}content{{/}} span (must not be split). */
function isCompleteHighlight(token: string): boolean {
  return /^\{\{(?:#[\da-fA-F]{6}|[a-z]+)\}\}.+\{\{\/\}\}$/.test(token);
}

/**
 * Split text into tokens for line wrapping. Highlight spans {{x}}...{{/}} are kept as single tokens.
 */
function tokens(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const result: string[] = [];
  const highlightRe = /\{\{(#[\da-fA-F]{6}|[a-z]+)\}\}(.+?)\{\{\/\}\}/gs;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  highlightRe.lastIndex = 0;
  while ((m = highlightRe.exec(trimmed)) !== null) {
    const before = trimmed.slice(lastIndex, m.index).trim();
    if (before) result.push(...before.split(/\s+/).filter(Boolean));
    result.push(m[0]);
    lastIndex = highlightRe.lastIndex;
  }
  const after = trimmed.slice(lastIndex).trim();
  if (after) result.push(...after.split(/\s+/).filter(Boolean));
  return result.length ? result : [trimmed];
}

/**
 * Wrap a single paragraph (no newlines) into lines that fit the zone width.
 * Never splits inside {{color}}...{{/}} so highlights render correctly.
 */
function wrapParagraph(paragraph: string, zone: TextZone, maxLines: number): string[] {
  if (!paragraph.trim()) return [];
  const maxCharsPerLine = charsPerLine(zone);
  const tokenList = tokens(paragraph);
  const lines: string[] = [];
  let currentLine = "";

  for (const token of tokenList) {
    const candidate = currentLine ? `${currentLine} ${token}` : token;
    if (candidate.length <= maxCharsPerLine) {
      currentLine = candidate;
    } else {
      if (currentLine) {
        lines.push(currentLine);
        if (lines.length >= maxLines) return lines;
      }
      if (token.length > maxCharsPerLine) {
        if (isCompleteHighlight(token)) {
          lines.push(token);
          if (lines.length >= maxLines) return lines;
          currentLine = "";
        } else {
          for (let i = 0; i < token.length; i += maxCharsPerLine) {
            lines.push(token.slice(i, i + maxCharsPerLine));
            if (lines.length >= maxLines) return lines;
          }
          currentLine = "";
        }
      } else {
        currentLine = token;
      }
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines;
}

/**
 * Fit text to zone: return lines that fit within maxLines and approximate width.
 * User newlines (Enter) are preserved as line breaks. Auto wrap within each paragraph.
 * Never splits inside {{color}}...{{/}} so highlights render correctly.
 */
export function fitTextToZone(text: string, zone: TextZone): string[] {
  if (!text.trim()) return [];

  const paragraphs = text.split(/\n/);
  const allLines: string[] = [];
  let remainingLines = zone.maxLines;

  for (const para of paragraphs) {
    if (remainingLines <= 0) break;
    const trimmed = para.trim();
    if (trimmed === "") {
      allLines.push("");
      remainingLines -= 1;
    } else {
      const paraLines = wrapParagraph(trimmed, zone, remainingLines);
      allLines.push(...paraLines);
      remainingLines -= paraLines.length;
    }
  }

  return allLines.slice(0, zone.maxLines);
}

/**
 * Shorten text to fit zone: return a single string that fits within maxLines and width.
 * Deterministic: joins the fitted lines. Use for "shorten to fit" without AI.
 */
export function shortenTextToZone(text: string, zone: TextZone): string {
  const lines = fitTextToZone(text, zone);
  return lines.join(" ").trim();
}
