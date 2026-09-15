import type { Page } from "playwright-core";
import { waitForFontsInPage } from "./waitForFonts";
import { waitForImagesInPage } from "./waitForImages";

export async function waitForSlideReady(page: Page, timeoutMs = 25_000): Promise<void> {
  await Promise.all([waitForImagesInPage(page, timeoutMs), waitForFontsInPage(page, timeoutMs)]);
  // Allow layout and paint to consume the decoded images and loaded fonts.
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
}
