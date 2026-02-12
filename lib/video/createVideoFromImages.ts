import { FFmpeg } from "@ffmpeg/ffmpeg";

const SECONDS_PER_SLIDE = 4;
const OUTPUT_FPS = 24; // Lower FPS = fewer frames to encode = faster (was 30)
const FADE_DURATION_SEC = 20 / OUTPUT_FPS;

/** Single shared FFmpeg instance + load promise so we can preload when dialog opens. */
let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoadPromise: Promise<FFmpeg> | null = null;

/**
 * Start loading FFmpeg in the background. Call when the user opens the video preview dialog
 * so that "Download MP4" doesn't wait on the ~20MB WASM load.
 */
export function preloadFFmpeg(): void {
  if (ffmpegLoadPromise) return;
  ffmpegLoadPromise = (async () => {
    const ffmpeg = new FFmpeg();
    await ffmpeg.load();
    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();
}

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (!ffmpegLoadPromise) preloadFFmpeg();
  return ffmpegLoadPromise!;
}

/**
 * Create an MP4 video from image URLs using ffmpeg.wasm in the browser.
 * Each image is shown for SECONDS_PER_SLIDE seconds with crossfade transitions (matches Remotion preview).
 * Uses parallel image fetch, faster x264 preset, and 24fps to reduce encode time.
 */
export async function createVideoFromImages(
  imageUrls: string[],
  width: number,
  height: number,
  onProgress?: (p: number) => void
): Promise<Blob> {
  const ffmpeg = await getFFmpeg();
  ffmpeg.on("progress", ({ progress }) => {
    onProgress?.(Math.min(1, progress));
  });

  // Fetch all images in parallel (was sequential — big win for many slides)
  const buffers = await Promise.all(
    imageUrls.map(async (url, i) => {
      const res = await fetch(url, { mode: "cors" });
      if (!res.ok) throw new Error(`Failed to fetch image ${i + 1}`);
      return res.arrayBuffer();
    })
  );

  for (let i = 0; i < buffers.length; i++) {
    const name = `img${String(i + 1).padStart(3, "0")}.png`;
    await ffmpeg.writeFile(name, new Uint8Array(buffers[i]!));
  }

  const n = imageUrls.length;
  const scale = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`;

  // -preset veryfast + -crf 23: much faster encode with good quality (was default preset = medium/slow)
  const x264Args = ["-preset", "veryfast", "-crf", "23"];

  let args: string[];

  if (n === 1) {
    args = [
      "-loop", "1", "-t", String(SECONDS_PER_SLIDE), "-framerate", String(OUTPUT_FPS),
      "-i", "img001.png",
      "-vf", `${scale},format=yuv420p`,
      "-c:v", "libx264",
      ...x264Args,
      "output.mp4",
    ];
  } else {
    const inputArgs: string[] = [];
    for (let i = 0; i < n; i++) {
      inputArgs.push("-loop", "1", "-t", String(SECONDS_PER_SLIDE), "-framerate", String(OUTPUT_FPS), "-i", `img${String(i + 1).padStart(3, "0")}.png`);
    }

    const scaleFilters: string[] = [];
    for (let i = 0; i < n; i++) {
      scaleFilters.push(`[${i}:v]${scale}[s${i}]`);
    }

    let length = SECONDS_PER_SLIDE;
    const xfadeParts: string[] = [];
    for (let i = 0; i < n - 1; i++) {
      const offset = length - FADE_DURATION_SEC;
      const prevLabel = i === 0 ? `s0` : `v${i}`;
      const nextLabel = `s${i + 1}`;
      const outLabel = `v${i + 1}`;
      xfadeParts.push(`[${prevLabel}][${nextLabel}]xfade=transition=fade:duration=${FADE_DURATION_SEC.toFixed(2)}:offset=${offset.toFixed(2)}[${outLabel}]`);
      length = length + SECONDS_PER_SLIDE - FADE_DURATION_SEC;
    }

    const filterComplex = scaleFilters.join(";") + ";" + xfadeParts.join(";") + `;[v${n - 1}]format=yuv420p[vout]`;

    args = [
      ...inputArgs.flat(),
      "-filter_complex", filterComplex,
      "-map", "[vout]",
      "-c:v", "libx264",
      ...x264Args,
      "output.mp4",
    ];
  }

  const exitCode = await ffmpeg.exec(args);

  if (exitCode !== 0) throw new Error("FFmpeg encoding failed");

  const data = await ffmpeg.readFile("output.mp4");
  const bytes =
    data instanceof Uint8Array
      ? data
      : typeof data === "string"
        ? new Uint8Array(Uint8Array.from(atob(data), (c) => c.charCodeAt(0)))
        : new Uint8Array(data as ArrayBuffer);
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  const blob = new Blob([copy], { type: "video/mp4" });

  for (let i = 0; i < imageUrls.length; i++) {
    const name = `img${String(i + 1).padStart(3, "0")}.png`;
    try {
      await ffmpeg.deleteFile(name);
    } catch {
      // ignore
    }
  }
  try {
    await ffmpeg.deleteFile("output.mp4");
  } catch {
    // ignore
  }

  return blob;
}
