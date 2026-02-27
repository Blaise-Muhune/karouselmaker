/**
 * Launch Chromium for HTML-to-image rendering.
 * On Vercel: uses @sparticuz/chromium-min with remote pack (brotli files not bundled).
 * Locally: uses Playwright's bundled Chromium.
 *
 * In production we copy the binary to a unique path before launch to avoid ETXTBSY
 * (Text file busy) when multiple exports run concurrently or the package is still writing the file.
 */
import { chmodSync, copyFileSync, cpSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join, dirname, basename } from "path";
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

/**
 * Copy Chromium to a unique path so we don't exec the same file another process is writing.
 * If the binary lives directly in /tmp we only copy the file (cannot copy /tmp into itself).
 * Otherwise we copy the whole directory (binary + libs).
 */
function copyChromiumToUniquePath(originalPath: string): { dir: string; executablePath: string } {
  const sourceDir = dirname(originalPath);
  const systemTmp = tmpdir();
  const dir = mkdtempSync(join(systemTmp, "chromium-"));
  const executablePath = join(dir, basename(originalPath));

  if (sourceDir === systemTmp || dir.startsWith(sourceDir + "/") || dir.startsWith(sourceDir + "\\")) {
    copyFileSync(originalPath, executablePath);
  } else {
    cpSync(sourceDir, dir, { recursive: true });
  }
  chmodSync(executablePath, 0o755);
  return { dir, executablePath };
}

export async function launchChromium() {
  if (IS_VERCEL) {
    const Chromium = (await import("@sparticuz/chromium-min")).default;
    Chromium.setGraphicsMode = false;
    const originalPath = await Chromium.executablePath(CHROMIUM_PACK_URL);
    const { dir, executablePath } = copyChromiumToUniquePath(originalPath);
    const browser = await playwrightChromium.launch({
      args: [...Chromium.args, ...SERVERLESS_ARGS],
      executablePath,
      headless: true,
      timeout: LAUNCH_TIMEOUT_MS,
    });
    browser.on("disconnected", () => {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    });
    return browser;
  }
  const { chromium } = await import("playwright");
  return chromium.launch({
    headless: true,
    args: ["--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage"],
    timeout: LAUNCH_TIMEOUT_MS,
  });
}
