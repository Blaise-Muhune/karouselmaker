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

/** Extra args for serverless stability (avoid browser closing unexpectedly in production). */
const SERVERLESS_ARGS = [
  "--disable-gpu",
  "--no-sandbox",
  "--no-zygote",
  "--disable-dev-shm-usage",
  "--disable-setuid-sandbox",
  "--disable-software-rasterizer",
  "--disable-extensions",
  "--disable-background-networking",
  "--disable-default-apps",
  "--no-first-run",
  "--mute-audio",
  "--disable-renderer-backgrounding",
  "--disable-backgrounding-occluded-windows",
  "--disable-hang-monitor",
  "--disable-breakpad",
  "--disable-features=TranslateUI",
];

/** Launch timeout (ms). Prevents hanging on cold start in serverless. */
const LAUNCH_TIMEOUT_MS = 60_000;

export async function launchChromium() {
  if (IS_VERCEL) {
    const Chromium = (await import("@sparticuz/chromium-min")).default;
    Chromium.setGraphicsMode = false;
    return playwrightChromium.launch({
      args: [...Chromium.args, ...SERVERLESS_ARGS],
      executablePath: await Chromium.executablePath(CHROMIUM_PACK_URL),
      headless: true,
      timeout: LAUNCH_TIMEOUT_MS,
    });
  }
  const { chromium } = await import("playwright");
  return chromium.launch({
    headless: true,
    args: ["--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage"],
    timeout: LAUNCH_TIMEOUT_MS,
  });
}
