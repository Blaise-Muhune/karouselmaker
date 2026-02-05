/**
 * Launch Chromium for HTML-to-image rendering.
 * On Vercel: uses @sparticuz/chromium-min with remote pack (brotli files not bundled).
 * Locally: uses Playwright's bundled Chromium.
 */
import { chromium as playwrightChromium } from "playwright-core";

const IS_VERCEL = process.env.VERCEL === "1";

/** Remote Chromium pack URL. Override via CHROMIUM_REMOTE_EXEC_PATH if GitHub times out. */
const CHROMIUM_PACK_URL =
  process.env.CHROMIUM_REMOTE_EXEC_PATH ||
  "https://github.com/Sparticuz/chromium/releases/download/v143.0.4/chromium-v143.0.4-pack.x64.tar";

export async function launchChromium() {
  if (IS_VERCEL) {
    const Chromium = (await import("@sparticuz/chromium-min")).default;
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
      executablePath: await Chromium.executablePath(CHROMIUM_PACK_URL),
      headless: true,
    });
  }
  const { chromium } = await import("playwright");
  return chromium.launch({
    headless: true,
    args: ["--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage"],
  });
}
