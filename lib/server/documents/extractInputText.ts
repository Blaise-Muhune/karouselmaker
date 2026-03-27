import { createRequire } from "node:module";

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024; // 10MB
/** Must stay below generateCarousel input_value max (10k) with buffer. */
const MAX_EXTRACTED_CHARS = 9500;

const DOC_EXT_RE = /\.(pdf|docx|txt|md|markdown|csv|json)$/i;

export type ExtractDocumentTextResult =
  | { ok: true; text: string; sourceName: string; truncated: boolean }
  | { ok: false; error: string };

function getFileName(file: File): string {
  return (file.name || "document").trim();
}

function trimForModelInput(text: string): { text: string; truncated: boolean } {
  const normalized = text.replace(/\u0000/g, "").replace(/\r\n/g, "\n").trim();
  if (normalized.length <= MAX_EXTRACTED_CHARS) return { text: normalized, truncated: false };
  return { text: condenseForCarouselInput(normalized, MAX_EXTRACTED_CHARS), truncated: true };
}

function condenseForCarouselInput(text: string, maxChars: number): string {
  // Keep intro + high-signal blocks so large docs still produce useful carousels.
  const blocks = text
    .split(/\n{2,}/)
    .map((b) => b.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (blocks.length === 0) return text.slice(0, maxChars).trim();

  const scoreBlock = (block: string, idx: number): number => {
    let score = 0;
    if (idx <= 2) score += 12; // keep early context
    if (block.length >= 120 && block.length <= 900) score += 6;
    if (/^#{1,6}\s|\b(summary|overview|key|takeaway|conclusion|result|insight|problem|solution|recommendation)\b/i.test(block)) score += 8;
    if (/\b\d+(\.\d+)?%|\$\d+|\bq[1-4]\b|\b(202\d|19\d\d|20\d\d)\b/i.test(block)) score += 4;
    if (/[.!?]/.test(block)) score += 2;
    return score;
  };

  const ranked = blocks
    .map((b, i) => ({ b, i, s: scoreBlock(b, i) }))
    .sort((a, b) => (b.s - a.s) || (a.i - b.i));

  const chosen = new Set<number>();
  // Always include first block.
  chosen.add(0);
  let used = Math.min(blocks[0]?.length ?? 0, maxChars);

  for (const item of ranked) {
    if (chosen.has(item.i)) continue;
    const addLen = item.b.length + 2;
    if (used + addLen > maxChars) continue;
    chosen.add(item.i);
    used += addLen;
    if (used >= maxChars * 0.92) break;
  }

  const assembled = [...chosen]
    .sort((a, b) => a - b)
    .map((i) => blocks[i]!)
    .join("\n\n")
    .trim();

  if (assembled.length <= maxChars) return assembled;
  return assembled.slice(0, maxChars).trim();
}

function isLikelyTextMime(type: string): boolean {
  return (
    type.startsWith("text/") ||
    type === "application/json" ||
    type === "application/xml" ||
    type === "application/csv"
  );
}

export async function extractInputTextFromDocument(file: File | null | undefined): Promise<ExtractDocumentTextResult> {
  if (!file) return { ok: false, error: "Please choose a document file." };
  const name = getFileName(file);
  const type = (file.type || "").toLowerCase();

  if (!DOC_EXT_RE.test(name) && !isLikelyTextMime(type) && type !== "application/pdf" && type !== "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return { ok: false, error: "Unsupported file. Use PDF, DOCX, TXT, MD, CSV, or JSON." };
  }
  if (file.size <= 0) return { ok: false, error: "The selected file is empty." };
  if (file.size > MAX_DOCUMENT_BYTES) {
    return { ok: false, error: "File too large. Max size is 10MB." };
  }

  try {
    const require = createRequire(import.meta.url);
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    let extracted = "";

    if (ext === "pdf" || type === "application/pdf") {
      // Load CJS build directly to avoid ESM/browser worker resolution issues in Next server runtime.
      const { PDFParse } = require("pdf-parse") as {
        PDFParse: new (opts: { data: Buffer }) => {
          getText: () => Promise<{ text?: string }>;
          destroy: () => Promise<void> | void;
        };
      };
      const arr = await file.arrayBuffer();
      const parser = new PDFParse({ data: Buffer.from(arr) });
      const parsed = await parser.getText();
      extracted = (parsed.text ?? "").trim();
      await parser.destroy();
    } else if (
      ext === "docx" ||
      type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const mammoth = await import("mammoth");
      const arr = await file.arrayBuffer();
      const parsed = await mammoth.extractRawText({ buffer: Buffer.from(arr) });
      extracted = (parsed.value ?? "").trim();
    } else {
      extracted = (await file.text()).trim();
    }

    if (!extracted) {
      return { ok: false, error: "Couldn't extract readable text from this file. Try a text-based PDF/DOCX." };
    }

    const trimmed = trimForModelInput(extracted);
    return { ok: true, text: trimmed.text, sourceName: name, truncated: trimmed.truncated };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to parse document";
    return { ok: false, error: `Couldn't read the document: ${msg}` };
  }
}

