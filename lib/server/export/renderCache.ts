import { createHash } from "node:crypto";

/** Bounded, user-scoped cache on a warm server. No files survive a deployment. */
const entries = new Map<string, { buffer: Buffer; expires: number }>();
const MAX_BYTES = 64 * 1024 * 1024;
const TTL_MS = 10 * 60 * 1000;
let bytes = 0;

export function renderCacheKey(userId: string, html: string, format: string, width: number, height: number): string | null {
  // Mutable remote images must be fetched again; only inline image bytes are safe to reuse.
  if (/(?:src\s*=\s*["']|url\(\s*["']?)(?:https?:)?\/\//i.test(html)) return null;
  return createHash("sha256").update(JSON.stringify([userId, html, format, width, height])).digest("hex");
}
export function getCachedRender(key: string | null): Buffer | undefined {
  if (!key) return undefined;
  const entry = entries.get(key);
  if (!entry) return undefined;
  entries.delete(key);
  if (entry.expires <= Date.now()) { bytes -= entry.buffer.length; return undefined; }
  entries.set(key, entry);
  return entry.buffer;
}
export function cacheRender(key: string | null, buffer: Buffer): void {
  if (!key || buffer.length > MAX_BYTES) return;
  const previous = entries.get(key);
  if (previous) { bytes -= previous.buffer.length; entries.delete(key); }
  for (const [oldKey, entry] of entries) {
    if (entry.expires <= Date.now() || bytes + buffer.length > MAX_BYTES) {
      entries.delete(oldKey); bytes -= entry.buffer.length;
    }
  }
  entries.set(key, { buffer, expires: Date.now() + TTL_MS });
  bytes += buffer.length;
}
