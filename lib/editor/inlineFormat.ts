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
 * Remove orphan highlight fragments so they never show as raw in the preview.
 * - "15}}...{{/}}" (from line-wrap splitting) -> inner text only
 * - Standalone "{{/}}" (no matching open on this line) -> remove
 * - Orphan "{{#hex}}" or "{{name}}" (no {{/}} after it on this line) -> remove
 */
export function stripOrphanHighlightFragments(text: string): string {
  return text
    .replace(/(?<!\{\{(?:#[\da-fA-F]{6}|[a-z]+)\})(?:\d{2,6})?\}\}([\s\S]+?)\{\{\/\}\}/g, "$1")
    .replace(/\{\{\/\}\}/g, "")
    .replace(/\{\{(?:#[\da-fA-F]{6}|[a-z]+)\}\}(?=(?:(?!\{\{\/\}\}).)*$)/g, "");
}

/** Remove all ** from normal segment text so they never show in the preview (line-wrap can leave "**." or "** " etc.). */
function stripOrphanBoldMarkers(text: string): string {
  return text.replace(/\*\*/g, "");
}

/** Strip highlight markup from segment text so {{/}} and {{#hex}} never show as literal (e.g. after line-wrap). */
function stripHighlightMarkersFromSegment(segmentText: string): string {
  return segmentText
    .replace(/\{\{\/\}\}/g, "")
    .replace(/\{\{(?:#[\da-fA-F]{6}|[a-z]+)\}\}/g, "");
}

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

    // Skip bold match if its content contains "{{" — likely line-wrap split highlight; treat as normal and parse highlight
    const boldContent = boldMatch ? (boldMatch[1] ?? "") : "";
    const boldIsBroken = boldContent.includes("{{");

    // Pick the first match
    if (colorIndex >= 0 && (boldIndex < 0 || boldIsBroken || colorIndex <= boldIndex)) {
      const match = colorMatch!;
      const before = remaining.slice(0, colorIndex);
      if (before) segments.push({ type: "normal", text: stripOrphanBoldMarkers(stripOrphanHighlightFragments(before)) });
      const colorKey = match[1] ?? "";
      const colorHex = colorKey.startsWith("#") ? colorKey : HIGHLIGHT_COLORS[colorKey] ?? "#facc15";
      segments.push({ type: "color", text: stripHighlightMarkersFromSegment(match[2] ?? ""), color: colorHex });
      remaining = remaining.slice(colorIndex + match[0].length);
    } else if (boldIndex >= 0 && !boldIsBroken && (unclosedIndex < 0 || boldIndex <= unclosedIndex)) {
      const match = boldMatch!;
      const before = remaining.slice(0, boldIndex);
      if (before) segments.push({ type: "normal", text: stripOrphanBoldMarkers(stripOrphanHighlightFragments(before)) });
      segments.push({ type: "bold", text: stripHighlightMarkersFromSegment(match[1] ?? "") });
      remaining = remaining.slice(boldIndex + match[0].length);
    } else if (unclosedIndex >= 0) {
      const match = unclosedMatch!;
      const before = remaining.slice(0, unclosedIndex);
      if (before) segments.push({ type: "normal", text: stripOrphanBoldMarkers(stripOrphanHighlightFragments(before)) });
      const colorKey = match[1] ?? "";
      const colorHex = colorKey.startsWith("#") ? colorKey : HIGHLIGHT_COLORS[colorKey] ?? "#facc15";
      const rest = stripHighlightMarkersFromSegment(match[2] ?? "");
      if (rest) segments.push({ type: "color", text: rest, color: colorHex });
      break;
    } else {
      // Only strip orphan fragments when showing as normal, so we never display raw }}...{{/}} or orphan **
      segments.push({ type: "normal", text: stripOrphanBoldMarkers(stripOrphanHighlightFragments(remaining)) });
      break;
    }
  }

  return segments;
}

export type HighlightSpan = { start: number; end: number; color: string };

/** Word character for boundary expansion (letters, digits, apostrophe for contractions). */
const WORD_CHAR = /[\p{L}\p{N}']/u;

/** Whitespace (space, newline, tab) — used to avoid expanding into the next word. */
const WHITESPACE = /\s/;

/**
 * Expand selection to full word boundaries. Never allow a single character inside a word.
 * Does not expand into an adjacent word (stops at spaces/newlines). Trims leading/trailing whitespace.
 * If the selection already spans multiple words (e.g. browser double-click selected "word1 word2"),
 * we keep only the first word so one click = one word.
 * Returns the expanded range or null if the selection is only whitespace/punctuation (drop highlight).
 */
export function expandSelectionToWordBoundaries(
  text: string,
  start: number,
  end: number
): { start: number; end: number } | null {
  const len = text.length;
  if (len === 0 || start >= end) return null;
  start = Math.max(0, Math.min(start, len));
  end = Math.max(0, Math.min(end, len));
  if (start >= end) return null;
  // Expand start backward to start of word
  while (start > 0 && WORD_CHAR.test(text[start - 1]!)) start--;
  // Expand end forward only within the same word — stop at space/newline so we never include the next word
  while (end < len && WORD_CHAR.test(text[end]!) && !WHITESPACE.test(text[end]!)) end++;
  if (start >= end) return null;
  // If selection spans multiple words (e.g. double-click gave "word1 word2"), keep only the first word
  const firstSpace = text.slice(start, end).search(WHITESPACE);
  if (firstSpace >= 0) end = start + firstSpace;
  if (start >= end) return null;
  // Trim leading/trailing whitespace so we only highlight the word, not spaces (avoids layout/newline issues)
  while (start < end && WHITESPACE.test(text[start]!)) start++;
  while (end > start && WHITESPACE.test(text[end - 1]!)) end--;
  if (start >= end) return null;
  const slice = text.slice(start, end);
  if (!slice || !WORD_CHAR.test(slice)) return null;
  return { start, end };
}

/**
 * Normalize highlight spans so each is on full words only. Drops spans that are only whitespace/punctuation.
 * Use before persisting (save, apply to all) so we never store single-character or partial-word highlights.
 */
export function normalizeHighlightSpansToWords(text: string, spans: HighlightSpan[]): HighlightSpan[] {
  if (!text || !spans.length) return [];
  const out: HighlightSpan[] = [];
  for (const s of spans) {
    const expanded = expandSelectionToWordBoundaries(text, s.start, s.end);
    if (expanded) out.push({ start: expanded.start, end: expanded.end, color: s.color });
  }
  out.sort((a, b) => a.start - b.start);
  return out;
}

/**
 * Keep highlight spans valid after text changed: clamp to length, drop invalid, re-anchor to word boundaries.
 * Use in the editor when headline or body text is edited so highlights don't point at wrong indices.
 */
export function clampHighlightSpansToText(text: string, spans: HighlightSpan[]): HighlightSpan[] {
  if (!text || !spans.length) return [];
  const len = text.length;
  const out: HighlightSpan[] = [];
  for (const s of spans) {
    const start = Math.max(0, Math.min(s.start, len));
    const end = Math.max(0, Math.min(s.end, len));
    if (start >= end) continue;
    const expanded = expandSelectionToWordBoundaries(text, start, end);
    if (expanded) out.push({ start: expanded.start, end: expanded.end, color: s.color });
  }
  out.sort((a, b) => a.start - b.start);
  return out;
}

/**
 * Inject {{#hex}}...{{/}} around each highlight span. Input text may already contain ** for bold.
 * Result is "bold wraps word, then color wraps that": {{#hex}}**word**{{/}} for correct parsing.
 * Spans are clamped to text length; overlapping spans are merged (last wins for overlap).
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

/** Common words we skip when picking "key" words to auto-highlight in body. */
const STOP_WORDS = new Set(
  "the a an and or but is are was were to of in on for with at by it be as this that have has had will would can could from not no so if we you they he she i".split(" ")
);

/**
 * Returns word runs as [start, end] (character indices) in order.
 * Word = sequence of letters, digits, apostrophe (contractions).
 */
function getWordRanges(text: string): { start: number; end: number; word: string }[] {
  const ranges: { start: number; end: number; word: string }[] = [];
  const re = /[\p{L}\p{N}']+/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    ranges.push({ start: m.index, end: m.index + (m[0]?.length ?? 0), word: (m[0] ?? "").toLowerCase() });
  }
  return ranges;
}

const TARGET_HIGHLIGHT_FRACTION = 0.6;

export type AutoHighlightOptions = {
  /** "headline" = words to ~60% coverage; "body" = same, skip stop words first then fill. */
  style: "headline" | "body";
  /** Default color for all spans (e.g. HIGHLIGHT_COLORS.yellow). */
  defaultColor?: string;
  /** Max spans (optional). If not set, target ~60% of words. */
  maxSpans?: number;
};

/**
 * Picks words to highlight so that roughly 60% of words are covered (or up to maxSpans).
 * - Headline: include words in order until we reach ~60% of word count (skip single-letter if it would look odd).
 * - Body: include first word, then content words (skip stop words), until ~60% coverage.
 */
export function getAutoHighlightSpans(text: string, options: AutoHighlightOptions): HighlightSpan[] {
  const words = getWordRanges(text);
  if (!words.length) return [];

  const targetCount = Math.max(1, Math.ceil(words.length * TARGET_HIGHLIGHT_FRACTION));
  const maxSpans = options.maxSpans ?? targetCount;
  const effectiveMax = Math.min(maxSpans, targetCount, words.length);

  const color = (options.defaultColor?.startsWith("#") ? options.defaultColor : HIGHLIGHT_COLORS[options.defaultColor ?? "yellow"]) ?? "#facc15";
  const spans: HighlightSpan[] = [];

  if (options.style === "headline") {
    for (let i = 0; i < words.length && spans.length < effectiveMax; i++) {
      const w = words[i]!;
      if (w.word.length > 1 || words.length <= 3) {
        spans.push({ start: w.start, end: w.end, color });
      }
    }
    return spans.slice(0, effectiveMax);
  }

  // Body: first word always, then add content words (skip stop words) until ~60%
  spans.push({ start: words[0]!.start, end: words[0]!.end, color });
  for (let i = 1; i < words.length && spans.length < effectiveMax; i++) {
    const w = words[i]!;
    if (STOP_WORDS.has(w.word)) continue;
    const isNumber = /^\d+$/.test(w.word);
    const isContentWord = w.word.length >= 2 || isNumber;
    if (isContentWord) spans.push({ start: w.start, end: w.end, color });
  }
  // If we're under 60% because of stop words, add remaining words to hit target
  for (let i = 1; spans.length < effectiveMax && i < words.length; i++) {
    const w = words[i]!;
    if (spans.some((s) => s.start === w.start)) continue;
    spans.push({ start: w.start, end: w.end, color });
  }
  spans.sort((a, b) => a.start - b.start);
  return spans.slice(0, effectiveMax);
}

/**
 * Convert AI-suggested highlight words (exact substrings) into highlight spans.
 * Finds every occurrence of each word in text; skips spans that would overlap a previous one.
 * Use when the AI provided headline_highlight_words or body_highlight_words.
 */
export function getHighlightSpansFromWords(
  text: string,
  words: string[],
  color: string
): HighlightSpan[] {
  if (!text || !words?.length) return [];
  const hex = color.startsWith("#") ? color : (HIGHLIGHT_COLORS[color] ?? "#facc15");
  const spans: HighlightSpan[] = [];
  for (const word of words) {
    const w = word?.trim();
    if (!w) continue;
    let pos = 0;
    for (;;) {
      const idx = text.indexOf(w, pos);
      if (idx < 0) break;
      const start = idx;
      const end = idx + w.length;
      const overlaps = spans.some(
        (s) =>
          (start >= s.start && start < s.end) ||
          (end > s.start && end <= s.end) ||
          (start <= s.start && end >= s.end)
      );
      if (!overlaps) spans.push({ start, end, color: hex });
      pos = end;
    }
  }
  spans.sort((a, b) => a.start - b.start);
  return spans;
}

function wordRangesCoveredBySpans(wordRanges: { start: number; end: number }[], spans: HighlightSpan[]): number {
  return wordRanges.filter(
    (w) => spans.some((s) => w.start < s.end && w.end > s.start)
  ).length;
}

/**
 * Keep highlight coverage at ~60%: if initial spans cover more than target, randomly trim to 60%;
 * if less, add spans from getAutoHighlightSpans until ~60%.
 */
export function ensureHighlightCoverage(
  text: string,
  initialSpans: HighlightSpan[],
  options: AutoHighlightOptions & { targetFraction?: number }
): HighlightSpan[] {
  const wordRanges = getWordRanges(text);
  const total = wordRanges.length;
  if (total === 0) return initialSpans;
  const targetFraction = options.targetFraction ?? TARGET_HIGHLIGHT_FRACTION;
  const targetCount = Math.max(1, Math.ceil(total * targetFraction));
  const ranges = wordRanges.map((r) => ({ start: r.start, end: r.end }));

  let covered = wordRangesCoveredBySpans(ranges, initialSpans);

  if (covered > targetCount) {
    // Trim: randomly remove spans until coverage is at or just above 60%
    let result = [...initialSpans];
    while (result.length > 0) {
      const currentCovered = wordRangesCoveredBySpans(ranges, result);
      if (currentCovered <= targetCount) break;
      const removable = result.filter((s) => {
        const without = result.filter((x) => x !== s);
        return without.length > 0 && wordRangesCoveredBySpans(ranges, without) >= targetCount;
      });
      if (removable.length === 0) break;
      const toRemove = removable[Math.floor(Math.random() * removable.length)]!;
      result = result.filter((x) => x !== toRemove);
    }
    result.sort((a, b) => a.start - b.start);
    return result;
  }

  if (covered < targetCount) {
    const autoSpans = getAutoHighlightSpans(text, options);
    const merged = [...initialSpans];
    for (const s of autoSpans) {
      if (wordRangesCoveredBySpans(ranges, merged) >= targetCount) break;
      const overlaps = merged.some((m) => s.start < m.end && s.end > m.start);
      if (!overlaps) merged.push(s);
    }
    merged.sort((a, b) => a.start - b.start);
    return merged;
  }

  return initialSpans;
}

/**
 * When we insert "**" at insertStart and "**" at insertEnd (4 chars total),
 * shift highlight span indices so they still refer to the same content.
 * Positions < insertStart: +0; in [insertStart, insertEnd]: +2; > insertEnd: +4.
 * So a span (insertStart, insertEnd) becomes (insertStart+2, insertEnd+2) and covers only the word between the **.
 */
export function shiftHighlightSpansForBoldInsert(
  spans: HighlightSpan[],
  insertStart: number,
  insertEnd: number
): HighlightSpan[] {
  if (insertEnd <= insertStart) return spans;
  const offset = (p: number) => (p < insertStart ? 0 : p <= insertEnd ? 2 : 4);
  return spans.map((s) => ({
    ...s,
    start: s.start + offset(s.start),
    end: s.end + offset(s.end),
  }));
}

/**
 * When we remove "**" at removeStart and "**" at removeEnd-2 (4 chars total),
 * shift highlight span indices back. Positions < removeStart+2: 0; in [removeStart+2, removeEnd-2): -2; >= removeEnd: -4.
 */
export function shiftHighlightSpansForBoldRemove(
  spans: HighlightSpan[],
  removeStart: number,
  removeEnd: number
): HighlightSpan[] {
  if (removeEnd <= removeStart + 4) return spans;
  const offset = (p: number) => (p >= removeEnd ? -4 : p > removeStart + 2 ? -2 : 0);
  return spans.map((s) => ({
    ...s,
    start: s.start + offset(s.start),
    end: s.end + offset(s.end),
  }));
}
