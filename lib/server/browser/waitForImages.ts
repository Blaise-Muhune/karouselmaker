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
        Promise.all(images.map(async (image) => {
          if (!image.currentSrc && !image.getAttribute("src")) return;
          await image.decode();
          if (!image.naturalWidth) throw new Error("Image could not be decoded");
        })),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("Images timed out. Please retry the export.")), timeout);
        }),
      ]);
    } finally { clearTimeout(timer); }
  }, timeoutMs);
}
