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
 * Visible character count for wrap decisions. Strips {{#hex}}...{{/}} markers and counts only the inner text
 * so highlighted words don't get isolated (markup was being counted and made lines appear "full" too early).
 */
function displayLength(s: string): number {
  const stripped = s.replace(/\{\{(?:#[\da-fA-F]{6}|[a-z]+)\}\}/g, "").replace(/\{\{\/\}\}/g, "");
  return stripped.length;
}

/** Visible text (strip highlight markers) for "is this a word?" checks. */
function visibleText(s: string): string {
  return s.replace(/\{\{(?:#[\da-fA-F]{6}|[a-z]+)\}\}/g, "").replace(/\{\{\/\}\}/g, "");
}

/** True if the token is a short word (1–2 chars) that contains a letter — avoid leaving it alone on a line. */
function isShortWordToken(token: string): boolean {
  const v = visibleText(token);
  return v.length >= 1 && v.length <= 2 && /\p{L}/u.test(v);
}

/** True if lastPart is acceptable to start a new line. When nextToken is a short word, "—" is ok (line will be "— A"). */
function isAcceptableLineStart(lastPart: string, nextToken?: string): boolean {
  const v = visibleText(lastPart).trim();
  if (v.length >= 2) return true;
  if (v.length === 1 && /\p{L}/u.test(v)) return true;
  if (nextToken && isShortWordToken(nextToken) && v.length <= 2) return true;
  return false;
}

/** Push a line, or append to the previous line if this line is only a short word (avoids "A" alone on a line). */
function pushLine(lines: string[], line: string): void {
  if (lines.length > 0 && isShortWordToken(line)) {
    lines[lines.length - 1] = lines[lines.length - 1] + " " + line;
  } else {
    lines.push(line);
  }
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
    const candidateDisplayLen = displayLength(candidate);
    const tokenDisplayLen = displayLength(token);
    if (candidateDisplayLen <= maxCharsPerLine) {
      currentLine = candidate;
    } else {
      if (currentLine) {
        if (isShortWordToken(token)) {
          let breakAt = -1;
          let pos = currentLine.length;
          while (true) {
            const spaceIndex = currentLine.lastIndexOf(" ", pos - 1);
            if (spaceIndex <= 0) break;
            const lastPart = currentLine.slice(spaceIndex).trim();
            if (lastPart && isAcceptableLineStart(lastPart, token)) {
              breakAt = spaceIndex;
              break;
            }
            pos = spaceIndex;
          }
          if (breakAt > 0) {
            const linePart = currentLine.slice(0, breakAt).trim();
            const lastPart = currentLine.slice(breakAt).trim();
            if (linePart && lastPart) {
              pushLine(lines, linePart);
              if (lines.length >= maxLines) return lines;
              currentLine = `${lastPart} ${token}`;
              continue;
            }
          }
          // No break found (e.g. currentLine is a single word). Avoid leaving short word alone: glue it to this line.
          currentLine = `${currentLine} ${token}`;
          continue;
        }
        pushLine(lines, currentLine);
        if (lines.length >= maxLines) return lines;
      }
      if (tokenDisplayLen > maxCharsPerLine) {
        if (isCompleteHighlight(token)) {
          lines.push(token);
          if (lines.length >= maxLines) return lines;
          currentLine = "";
        } else {
          const plain = token.replace(/\{\{(?:#[\da-fA-F]{6}|[a-z]+)\}\}/g, "").replace(/\{\{\/\}\}/g, "");
          for (let i = 0; i < plain.length; i += maxCharsPerLine) {
            lines.push(plain.slice(i, i + maxCharsPerLine));
            if (lines.length >= maxLines) return lines;
          }
          currentLine = "";
        }
      } else {
        // Never start a new line with only a short word (e.g. "A") — append to previous line.
        if (lines.length > 0 && isShortWordToken(token)) {
          lines[lines.length - 1] = lines[lines.length - 1] + " " + token;
        } else {
          currentLine = token;
        }
      }
    }
  }

  if (currentLine) pushLine(lines, currentLine);
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
