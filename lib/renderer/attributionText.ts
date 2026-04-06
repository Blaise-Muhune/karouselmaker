/**
 * Single-line handle for bottom attribution (made-with line). No marketing filler.
 * Corner logo watermark uses `brandKit.logo_url` when set; otherwise watermark shows raw `watermark_text`.
 */
export function formatHandleAttribution(raw: string | undefined | null): string {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (s === "") return "";
  if (s.startsWith("@")) return s.slice(0, 200);
  if (/^[\w.]+$/.test(s)) return `@${s}`.slice(0, 200);
  return s.slice(0, 200);
}
