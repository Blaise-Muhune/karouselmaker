import type { TextZone } from "@/lib/server/renderer/templateSchema";
import { shortenTextToZone } from "./fitText";

function normalizeWs(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

/**
 * When the deterministic "fit to zone" result is already the same length as main,
 * produce a shorter alternate (first sentence, or first ~45% of words, or truncated).
 */
function makeShorterAlternate(main: string): string {
  const t = main.trim();
  if (!t) return "";
  const bySentence = t.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  if (bySentence.length > 1) return bySentence[0]!;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length <= 4) return t.length > 48 ? `${t.slice(0, 45).trim()}…` : t;
  const take = Math.max(3, Math.ceil(words.length * 0.42));
  return `${words.slice(0, take).join(" ")}${take < words.length ? "…" : ""}`.trim();
}

/**
 * Longer variant: split into two paragraphs when possible, else two logical halves.
 */
function makeLongBody(main: string): string {
  const t = main.trim();
  if (!t) return "";
  const paras = t.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  if (paras.length >= 2) return paras.join("\n\n");
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length <= 10) return `${t}\n\n${t}`;
  const mid = Math.floor(words.length / 2);
  return `${words.slice(0, mid).join(" ")}\n\n${words.slice(mid).join(" ")}`.trim();
}

/**
 * Three body-only rewrite options for the editor (main, shorter, longer).
 * Headline is not considered — use only for subtext/body zone.
 */
export function buildBodyRewriteVariants(body: string, zone: TextZone): [string, string, string] {
  const main = body.trim();
  if (!main) return ["", "", ""];

  const shortFit = shortenTextToZone(main, zone);
  const mainNorm = normalizeWs(main);
  const shortNorm = normalizeWs(shortFit);

  const fitsAlready =
    mainNorm === shortNorm ||
    (shortNorm.length >= mainNorm.length * 0.97 && shortNorm.length <= mainNorm.length + 2);

  let shortAlt = fitsAlready ? makeShorterAlternate(main) : shortFit;
  if (normalizeWs(shortAlt) === mainNorm && main.length > 0) {
    shortAlt = makeShorterAlternate(main);
  }
  if (normalizeWs(shortAlt) === mainNorm) {
    shortAlt = main.length > 56 ? `${main.slice(0, 52).trim()}…` : main;
  }

  let longBody = makeLongBody(main);
  if (normalizeWs(longBody) === mainNorm) {
    longBody = `${main}\n\n${main}`;
  }

  return [main, shortAlt, longBody];
}
