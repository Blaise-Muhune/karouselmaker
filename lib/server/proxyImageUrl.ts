import { createHmac, timingSafeEqual } from "crypto";

const SECRET = process.env.IMAGE_PROXY_SECRET;

/**
 * Build a same-origin proxy URL for an external image so the client can fetch it without CORS.
 * Returns null if the URL is same-origin or if IMAGE_PROXY_SECRET is not set.
 */
export function createProxyImageUrl(targetUrl: string, appOrigin: string): string | null {
  if (!SECRET) return null;
  try {
    const target = new URL(targetUrl);
    const app = new URL(appOrigin);
    if (target.origin === app.origin) return null;
    if (!/^https?:$/i.test(target.protocol)) return null;
    const sig = createHmac("sha256", SECRET).update(targetUrl).digest("hex");
    const params = new URLSearchParams({ url: targetUrl, sig });
    return `${appOrigin}/api/proxy-image?${params.toString()}`;
  } catch {
    return null;
  }
}

export function verifyProxySignature(url: string, sig: string): boolean {
  if (!SECRET || !sig) return false;
  const expected = createHmac("sha256", SECRET).update(url).digest("hex");
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
