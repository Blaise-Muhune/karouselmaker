import { FFmpeg } from "@ffmpeg/ffmpeg";

const SECONDS_PER_SLIDE = 4;
const FADE_DURATION_SEC = 20 / 30;
const OUTPUT_FPS = 30;

/**
 * Create an MP4 video from image URLs using ffmpeg.wasm in the browser.
 * Each image is shown for SECONDS_PER_SLIDE seconds with crossfade transitions (matches Remotion preview).
 */
export async function createVideoFromImages(
  imageUrls: string[],
  width: number,
  height: number,
  onProgress?: (p: number) => void
): Promise<Blob> {
  const ffmpeg = new FFmpeg();

  ffmpeg.on("progress", ({ progress }) => {
    onProgress?.(Math.min(1, progress));
  });

  await ffmpeg.load();

  for (let i = 0; i < imageUrls.length; i++) {
    const name = `img${String(i + 1).padStart(3, "0")}.png`;
    const res = await fetch(imageUrls[i]!, { mode: "cors" });
    if (!res.ok) throw new Error(`Failed to fetch image ${i + 1}`);
    const data = await res.arrayBuffer();
    await ffmpeg.writeFile(name, new Uint8Array(data));
  }

  const n = imageUrls.length;
  const scale = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`;

  let args: string[];
  let filterComplex: string;

  if (n === 1) {
    args = [
      "-loop", "1", "-t", String(SECONDS_PER_SLIDE), "-framerate", String(OUTPUT_FPS),
      "-i", "img001.png",
      "-vf", `${scale},format=yuv420p`,
      "-c:v", "libx264",
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

    filterComplex = scaleFilters.join(";") + ";" + xfadeParts.join(";") + `;[v${n - 1}]format=yuv420p[vout]`;

    args = [
      ...inputArgs.flat(),
      "-filter_complex", filterComplex,
      "-map", "[vout]",
      "-c:v", "libx264",
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
