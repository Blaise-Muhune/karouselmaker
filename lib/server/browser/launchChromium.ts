/**
 * Launch Chromium for HTML-to-image rendering.
 * On Vercel: uses @sparticuz/chromium-min with remote pack (brotli files not bundled).
 * Locally: uses Playwright's bundled Chromium.
 *
 * In production we copy the binary to a unique path before launch to avoid ETXTBSY
 * (Text file busy) when multiple exports run concurrently or the package is still writing the file.
 */
import { chmodSync, cpSync, mkdtempSync, rmSync } from "fs";
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
  "--disable-features=TranslateUI,AudioServiceOutOfProcess",
  "--disable-font-subpixel-positioning",
  "--disable-background-timer-throttling",
];

/** Launch timeout (ms). Prevents hanging on cold start in serverless. */
const LAUNCH_TIMEOUT_MS = 60_000;

/**
 * Copy Chromium to a unique path so we don't exec the same file another process is writing.
 * If the binary lives directly in /tmp we cannot copy (would copy /tmp into itself) and copying
 * only the file breaks the binary (missing .so libs) so it exits immediately. In that case we
 * use the original path and serialize launches to reduce ETXTBSY risk.
 */
function copyChromiumToUniquePath(originalPath: string): { dir: string; executablePath: string } | null {
  const sourceDir = dirname(originalPath);
  const systemTmp = tmpdir();
  if (sourceDir === systemTmp || join(systemTmp, "chromium-").startsWith(sourceDir + "/") || join(systemTmp, "chromium-").startsWith(sourceDir + "\\")) {
    return null;
  }
  const dir = mkdtempSync(join(systemTmp, "chromium-"));
  const executablePath = join(dir, basename(originalPath));
  cpSync(sourceDir, dir, { recursive: true });
  chmodSync(executablePath, 0o755);
  return { dir, executablePath };
}

/** Serialize production launches so we don't exec the same binary concurrently (ETXTBSY). */
let launchQueue: Promise<unknown> = Promise.resolve();

export async function launchChromium() {
  if (IS_VERCEL) {
    launchQueue = launchQueue
      .then(async () => {
        const Chromium = (await import("@sparticuz/chromium-min")).default;
        Chromium.setGraphicsMode = false;
        const originalPath = await Chromium.executablePath(CHROMIUM_PACK_URL);
        const copyResult = copyChromiumToUniquePath(originalPath);
        const executablePath = copyResult ? copyResult.executablePath : originalPath;
        const dir = copyResult?.dir;

        const packageArgs = (Chromium.args as string[]).filter((a) => a !== "--single-process");
        const browser = await playwrightChromium.launch({
          args: [...packageArgs, ...SERVERLESS_ARGS],
          executablePath,
          headless: true,
          timeout: LAUNCH_TIMEOUT_MS,
        });
        if (dir) {
          browser.on("disconnected", () => {
            try {
              rmSync(dir, { recursive: true, force: true });
            } catch {
              // ignore
            }
          });
        }
        return browser;
      })
      .catch((err) => {
        launchQueue = Promise.resolve();
        throw err;
      });
    return launchQueue as Promise<Awaited<ReturnType<typeof playwrightChromium.launch>>>;
  }
  const { chromium } = await import("playwright");
  return chromium.launch({
    headless: true,
    args: ["--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage"],
    timeout: LAUNCH_TIMEOUT_MS,
  });
}
