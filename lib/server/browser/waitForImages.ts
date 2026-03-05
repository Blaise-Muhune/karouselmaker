import type { Page } from "playwright-core";

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Wait for all <img> elements in the page to be fully loaded (complete and decoded).
 * Reduces pitch-black or partial images in export/video screenshots when images load slowly.
 */
export async function waitForImagesInPage(
  page: Page,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<void> {
  await page.evaluate(
    async (timeout) => {
      const imgs = Array.from(document.querySelectorAll<HTMLImageElement>("img"));
      if (imgs.length === 0) return;

      await Promise.race([
        Promise.all(
          imgs.map(
            (img) =>
              new Promise<void>((resolve, reject) => {
                if (img.complete && img.naturalWidth > 0) {
                  resolve();
                  return;
                }
                const t = setTimeout(() => {
                  reject(new Error("Image load timeout"));
                }, timeout);
                img.addEventListener("load", () => {
                  clearTimeout(t);
                  resolve();
                });
                img.addEventListener("error", () => {
                  clearTimeout(t);
                  resolve();
                });
              })
          )
        ),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error("waitForImages timeout")), timeout)
        ),
      ]);
    },
    timeoutMs
  );
}
