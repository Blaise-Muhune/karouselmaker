import { afterEach, expect, it, vi } from "vitest";
import { cacheRender, getCachedRender, renderCacheKey } from "./renderCache";
afterEach(() => vi.useRealTimers());
it("reuses identical renders but isolates users, edits, formats and sizes", () => {
  const key = renderCacheKey("user-a", "<p>Saved slide</p>", "png", 1080, 1350);
  cacheRender(key, Buffer.from("image"));
  expect(getCachedRender(key)?.toString()).toBe("image");
  for (const changed of [
    renderCacheKey("user-b", "<p>Saved slide</p>", "png", 1080, 1350),
    renderCacheKey("user-a", "<p>Edited slide</p>", "png", 1080, 1350),
    renderCacheKey("user-a", "<p>Saved slide</p>", "jpeg", 1080, 1350),
    renderCacheKey("user-a", "<p>Saved slide</p>", "png", 1080, 1920),
  ]) expect(getCachedRender(changed)).toBeUndefined();
});
it("does not cache mutable remote image URLs", () => {
  expect(renderCacheKey("a", '<img src="https://example.com/image.png">', "png", 1, 1)).toBeNull();
  expect(renderCacheKey("a", 'background-image:url(https://example.com/image.png)', "png", 1, 1)).toBeNull();
  expect(renderCacheKey("a", '<img src="data:image/png;base64,abc">', "png", 1, 1)).not.toBeNull();
});
it("expires cached images", () => {
  vi.useFakeTimers();
  const key = renderCacheKey("expiry", "slide", "png", 1, 1);
  cacheRender(key, Buffer.from("image"));
  vi.advanceTimersByTime(600_001);
  expect(getCachedRender(key)).toBeUndefined();
});
