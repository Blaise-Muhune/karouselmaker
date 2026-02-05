/**
 * Launch Chromium for HTML-to-image rendering.
 * On Vercel: uses @sparticuz/chromium (serverless-compatible binary).
 * Locally: uses Playwright's bundled Chromium.
 */
import { chromium as playwrightChromium } from "playwright-core";

const IS_VERCEL = process.env.VERCEL === "1";

export async function launchChromium() {
  if (IS_VERCEL) {
    const Chromium = (await import("@sparticuz/chromium")).default;
    // Disable WebGL for faster cold starts on serverless
    Chromium.setGraphicsMode = false;
    return playwrightChromium.launch({
      args: [
        ...Chromium.args,
        "--disable-gpu",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-setuid-sandbox",
      ],
      executablePath: await Chromium.executablePath(),
      headless: true,
    });
  }
  const { chromium } = await import("playwright");
  return chromium.launch({
    headless: true,
    args: ["--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage"],
  });
}
