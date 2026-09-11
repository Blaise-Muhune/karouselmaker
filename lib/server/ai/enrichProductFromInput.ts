import OpenAI from "openai";
import { PRODUCT_TO_PROMOTE_MAX_CHARS } from "@/lib/constants";

const FETCH_TIMEOUT_MS = 12_000;
const MAX_HTML_BYTES = 1_500_000;
const MAX_TEXT_CHARS = 12_000;
const BRIEF_MAX_CHARS = 1800;

const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi;

export type ProductContextFields = {
  /** Raw user input (URL and/or description). */
  product_to_promote: string;
  /** First http(s) URL extracted from input, if any. */
  product_url: string | null;
  /** Text the generation model should use (enriched from page or typed text). */
  product_brief: string;
};

export function extractFirstHttpUrl(text: string): string | null {
  const match = text.match(URL_RE);
  if (!match?.[0]) return null;
  let url = match[0].replace(/[.,;:!?)]+$/, "");
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

function isPrivateOrLocalHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  if (h === "localhost" || h === "0.0.0.0" || h.endsWith(".localhost") || h.endsWith(".local")) {
    return true;
  }
  // IPv4
  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  }
  // IPv6 loopback / link-local / ULA
  if (h === "::1" || h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true;
  return false;
}

function stripHtmlToText(html: string): string {
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  const title = s.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, "").trim();
  const metaDesc =
    s.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    s.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i)?.[1] ||
    s.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1];
  const ogTitle =
    s.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    s.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1];

  s = s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  const header = [ogTitle || title, metaDesc].filter(Boolean).join("\n");
  const combined = [header, s].filter(Boolean).join("\n\n");
  return combined.slice(0, MAX_TEXT_CHARS);
}

async function fetchPageText(url: string): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (isPrivateOrLocalHost(parsed.hostname)) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(parsed.toString(), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "User-Agent": "KarouselmakerBot/1.0 (+product-context)",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const ctype = res.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml/i.test(ctype) && ctype.length > 0) {
      // Some sites omit content-type; still try if empty
      if (!ctype.includes("text") && !ctype.includes("html") && ctype !== "") return null;
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_HTML_BYTES) return null;
    const html = new TextDecoder("utf-8", { fatal: false }).decode(buf);
    const text = stripHtmlToText(html);
    return text.trim().length >= 40 ? text : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function summarizeProductPage(params: {
  url: string;
  pageText: string;
  userNotes: string;
}): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const openai = new OpenAI({ apiKey });
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    max_tokens: 700,
    messages: [
      {
        role: "system",
        content: `You turn a product/SaaS landing page into a short brief for Instagram carousel copywriters.
Output plain text only (no markdown headings). Max ~${BRIEF_MAX_CHARS} characters.
Include: product name, what it is (1 line), who it's for, 3–5 concrete benefits/outcomes, how it's different, soft CTA ideas (bio/DM/try—no hard sell), and any notable pricing/positioning if clear.
Do not invent features, metrics, or claims not supported by the page. If unclear, say so briefly.`,
      },
      {
        role: "user",
        content: `URL: ${params.url}
Extra notes from user (may be empty): ${params.userNotes || "(none)"}

Page text:
${params.pageText}`,
      },
    ],
  });

  const brief = completion.choices[0]?.message?.content?.trim() ?? "";
  if (!brief) return null;
  return brief.slice(0, BRIEF_MAX_CHARS);
}

/**
 * Resolve product context for a project: URL → fetch + AI brief; plain text → use as brief.
 * Reuses previous brief when the raw input is unchanged.
 */
export async function enrichProductContext(
  rawInput: string,
  previous?: Partial<ProductContextFields> | null
): Promise<ProductContextFields> {
  const product_to_promote = rawInput.trim().slice(0, PRODUCT_TO_PROMOTE_MAX_CHARS);
  if (!product_to_promote) {
    return { product_to_promote: "", product_url: null, product_brief: "" };
  }

  if (
    previous &&
    previous.product_to_promote?.trim() === product_to_promote &&
    previous.product_brief?.trim()
  ) {
    return {
      product_to_promote,
      product_url: previous.product_url ?? extractFirstHttpUrl(product_to_promote),
      product_brief: previous.product_brief.trim().slice(0, BRIEF_MAX_CHARS),
    };
  }

  const product_url = extractFirstHttpUrl(product_to_promote);
  if (!product_url) {
    return {
      product_to_promote,
      product_url: null,
      product_brief: product_to_promote.slice(0, BRIEF_MAX_CHARS),
    };
  }

  const notesWithoutUrl = product_to_promote.replace(product_url, " ").replace(/\s+/g, " ").trim();
  const pageText = await fetchPageText(product_url);
  if (!pageText) {
    // Fetch failed — still pass URL + any typed notes so generation can use web search / name alone.
    const fallback = [product_url, notesWithoutUrl].filter(Boolean).join("\n").slice(0, BRIEF_MAX_CHARS);
    return { product_to_promote, product_url, product_brief: fallback };
  }

  const brief = await summarizeProductPage({
    url: product_url,
    pageText,
    userNotes: notesWithoutUrl,
  });
  return {
    product_to_promote,
    product_url,
    product_brief: (brief || [product_url, notesWithoutUrl].filter(Boolean).join("\n")).slice(
      0,
      BRIEF_MAX_CHARS
    ),
  };
}

/** Prefer AI/page brief for generation prompts. */
export function productBriefForGeneration(rules: {
  product_brief?: string;
  product_to_promote?: string;
}): string {
  return (rules.product_brief?.trim() || rules.product_to_promote?.trim() || "").slice(0, BRIEF_MAX_CHARS);
}
