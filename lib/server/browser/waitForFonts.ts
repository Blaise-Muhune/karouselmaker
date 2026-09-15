import type { Page } from "playwright-core";

/** Never capture a fallback face while the intended font is loading or has failed. */
export async function waitForFontsInPage(page: Page, timeoutMs = 10_000): Promise<void> {
  await page.evaluate(async (timeout) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        (async () => {
          await document.fonts.ready;
          const faces = Array.from(document.fonts);
          if (document.querySelector('link[href*="fonts.googleapis.com"]') && faces.length === 0) {
            throw new Error("Export fonts could not load. Please retry the export.");
          }
          if (faces.some((face) => face.status === "error")) {
            throw new Error("An export font failed to load. Please retry the export.");
          }
        })(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("Export fonts timed out. Please retry the export.")), timeout);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }, timeoutMs);
}
