/**
 * Shared helpers and constants for image search (Brave + Unsplash routing, cache).
 */

/** Normalize query for cache keys: trim, lowercase, cap length. */
export function normalizeQueryForCache(q: string): string {
  return q.trim().toLowerCase().slice(0, 200);
}

export const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const CACHE_MAX_ENTRIES = 500;

/** Evict oldest entries from a cache Map when at capacity. Removes 10% or 50 entries (whichever is smaller) to reduce thrashing. */
export function evictCacheBatch<K, V>(cache: Map<K, V>): void {
  if (cache.size < CACHE_MAX_ENTRIES) return;
  const toEvict = Math.min(50, Math.max(1, Math.floor(cache.size * 0.1)));
  const keys = [...cache.keys()].slice(0, toEvict);
  keys.forEach((k) => cache.delete(k));
}
