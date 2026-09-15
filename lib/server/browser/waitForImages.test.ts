import { afterEach, expect, it, vi } from "vitest";
import type { Page } from "playwright-core";
import { waitForImagesInPage } from "./waitForImages";
const page = { evaluate: (fn: (timeout: number) => Promise<void>, timeout: number) => fn(timeout) } as unknown as Page;
afterEach(() => vi.unstubAllGlobals());
it("waits for actual decoding instead of a fixed delay", async () => {
  let finish!: () => void;
  const decode = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
  vi.stubGlobal("document", { images: [{ currentSrc: "image", naturalWidth: 10, decode }], querySelectorAll: () => [] });
  let ready = false;
  const result = waitForImagesInPage(page).then(() => { ready = true; });
  await Promise.resolve();
  expect(ready).toBe(false);
  finish();
  await result;
  expect(ready).toBe(true);
});
it("rejects broken images instead of exporting an empty image", async () => {
  vi.stubGlobal("document", { images: [{ currentSrc: "image", decode: () => Promise.reject(new Error("broken")) }], querySelectorAll: () => [] });
  await expect(waitForImagesInPage(page)).rejects.toThrow("broken");
});
it("decodes CSS background images too", async () => {
  const decode = vi.fn(async () => {});
  vi.stubGlobal("Image", class { src = ""; naturalWidth = 10; get currentSrc() { return this.src; } decode = decode; });
  vi.stubGlobal("document", { images: [], querySelectorAll: () => [{}] });
  vi.stubGlobal("getComputedStyle", () => ({ backgroundImage: 'url("https://example.com/image.png")' }));
  await waitForImagesInPage(page);
  expect(decode).toHaveBeenCalledOnce();
});
