import type { Page } from "playwright-core";

/** Decode every image, including CSS backgrounds, before capturing a slide. */
export async function waitForImagesInPage(page: Page, timeoutMs = 15_000): Promise<void> {
  await page.evaluate(async (timeout) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const images = Array.from(document.images);
      const urls = new Set<string>();
      for (const element of Array.from(document.querySelectorAll("*"))) {
        const background = getComputedStyle(element).backgroundImage;
        for (const match of background.matchAll(/url\(["']?(.*?)["']?\)/g)) {
          if (match[1]) urls.add(match[1]);
        }
      }
      for (const url of urls) {
        const image = new Image();
        image.src = url;
        images.push(image);
      }
      await Promise.race([
        Promise.all(
          images.map(async (image) => {
            if (!image.currentSrc && !image.getAttribute("src")) return;
            try {
              await image.decode();
            } catch (err) {
              const name = err && typeof err === "object" && "name" in err ? String((err as { name: unknown }).name) : "";
              const message = err instanceof Error ? err.message : String(err);
              if (name === "EncodingError" || /cannot be decoded/i.test(message)) {
                throw new Error(
                  "A slide background image could not be decoded. Stock photos sometimes use AVIF/WebP that export cannot render — pick another image or retry."
                );
              }
              throw err;
            }
            if (!image.naturalWidth) throw new Error("Image could not be decoded");
          })
        ),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("Images timed out. Please retry the export.")), timeout);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }, timeoutMs);
}
