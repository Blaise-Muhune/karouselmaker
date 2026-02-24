import { FFmpeg } from "@ffmpeg/ffmpeg";

export const SECONDS_PER_SLIDE = 4;
/** Minimum total video duration when using voiceover (e.g. 30s). */
export const MIN_VIDEO_DURATION_SEC = 30;
const SEGMENTS_PER_SLIDE = 2;
const SECONDS_PER_SEGMENT = SECONDS_PER_SLIDE / SEGMENTS_PER_SLIDE;
const OUTPUT_FPS = 24;
const SEGMENT_FRAMES = Math.round(SECONDS_PER_SEGMENT * OUTPUT_FPS);
const FADE_DURATION_SEC = 0.65;

/** Rotate 2–3 transition types so it doesn't feel repetitive. */
const SLIDE_TRANSITIONS = ["fade", "wipeleft", "slideright"] as const;

/** center = middle of frame (safe). safe_lower = above platform UI (TikTok/Reels avoid bottom 20–35%). */
export type CaptionPosition = "bottom_center" | "lower_third" | "center" | "safe_lower";

/** Single shared FFmpeg instance + load promise so we can preload when dialog opens. */
let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoadPromise: Promise<FFmpeg> | null = null;

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
 * Create an MP4 from slide image URLs with:
 * - 2 segments per slide (same image): first slow zoom in, second slow zoom out / pan
 * - Ken Burns (zoompan) for motion
 * - Varied transitions between slides (fade, wipe, slide)
 * - Higher quality (-crf 20), single scale to preserve sharpness
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

  // Quality: -crf 20 (better than 23), single scale to avoid re-compression blur
  const x264Args = ["-preset", "veryfast", "-crf", "20"];

  if (n === 0) {
    throw new Error("No images");
  }

  // Build 2 segments per slide: same image, segment 0 = zoom in, segment 1 = zoom out (Ken Burns)
  const totalSegments = n * SEGMENTS_PER_SLIDE;
  const inputArgs: string[] = [];
  for (let i = 0; i < n; i++) {
    const name = `img${String(i + 1).padStart(3, "0")}.png`;
    for (let seg = 0; seg < SEGMENTS_PER_SLIDE; seg++) {
      inputArgs.push("-loop", "1", "-t", String(SECONDS_PER_SEGMENT), "-framerate", String(OUTPUT_FPS), "-i", name);
    }
  }

  // Every segment: zoom + diagonal pan so the image never looks still (avoids "video stuck" feel).
  const zoomRange = 0.14; // 1.0 -> 1.14
  const panPct = 0.08; // 8% of frame per axis
  const filters: string[] = [];
  for (let i = 0; i < totalSegments; i++) {
    const inLabel = `${i}:v`;
    const scaled = `s${i}`;
    const seg = i % SEGMENTS_PER_SLIDE;
    const zoomIn = seg === 0;
    const zExpr = zoomIn
      ? `'min(1+${zoomRange}*on/${SEGMENT_FRAMES},1+${zoomRange})'`
      : `'max(1+${zoomRange}-${zoomRange}*on/${SEGMENT_FRAMES},1)'`;
    const dir = i % 4; // 0=right+down, 1=left+up, 2=right+up, 3=left+down
    const xPos = dir === 0 || dir === 2;
    const yPos = dir === 0 || dir === 3;
    const xExpr = xPos
      ? `'iw/2-(iw/zoom/2)+iw*${panPct}*on/${SEGMENT_FRAMES}'`
      : `'iw/2-(iw/zoom/2)-iw*${panPct}*on/${SEGMENT_FRAMES}'`;
    const yExpr = yPos
      ? `'ih/2-(ih/zoom/2)+ih*${panPct}*on/${SEGMENT_FRAMES}'`
      : `'ih/2-(ih/zoom/2)-ih*${panPct}*on/${SEGMENT_FRAMES}'`;
    filters.push(`[${inLabel}]${scale}[${scaled}]`);
    filters.push(`[${scaled}]zoompan=z=${zExpr}:x=${xExpr}:y=${yExpr}:d=1:s=${width}x${height}:fps=${OUTPUT_FPS}[z${i}]`);
  }

  // Chain segments: z0, z1, ... with xfade. Offset for join i = i*(SEGMENTS_PER_SEGMENT - FADE).
  let prevLabel = "z0";
  let currentDurationSec = SECONDS_PER_SEGMENT;

  for (let i = 1; i < totalSegments; i++) {
    const offset = currentDurationSec - FADE_DURATION_SEC;
    const nextLabel = `z${i}`;
    const outLabel = i === totalSegments - 1 ? "vlast" : `v${i}`;
    const isBetweenSlides = i % SEGMENTS_PER_SLIDE === 0;
    const transition = isBetweenSlides
      ? SLIDE_TRANSITIONS[(i / SEGMENTS_PER_SLIDE - 1) % SLIDE_TRANSITIONS.length]
      : "fade";
    filters.push(`[${prevLabel}][${nextLabel}]xfade=transition=${transition}:duration=${FADE_DURATION_SEC.toFixed(2)}:offset=${offset.toFixed(2)}[${outLabel}]`);
    prevLabel = outLabel;
    currentDurationSec += SECONDS_PER_SEGMENT - FADE_DURATION_SEC;
  }

  // yuv420p for compatibility; single output label [vout]
  if (totalSegments === 1) {
    filters.push("[z0]format=yuv420p[vout]");
  } else {
    filters.push("[vlast]format=yuv420p[vout]");
  }

  const filterComplex = filters.join(";");

  const args = [
    ...inputArgs.flat(),
    "-filter_complex",
    filterComplex,
    "-map",
    "[vout]",
    "-c:v",
    "libx264",
    ...x264Args,
    "output.mp4",
  ];

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

const MAX_BACKGROUNDS_PER_SLIDE = 3;
const OVERLAY_FADE_IN_SEC = 0.5;

export type LayeredSlideInput = {
  backgroundUrls: string[];
  overlayUrl: string | null;
};

export type CaptionCue = { text: string; start: number; end: number };

export type CreateVideoOptions = {
  /** When set (e.g. 30), slide duration is extended so total video is at least this many seconds. Ignored if slideDurationsSec is set. */
  minDurationSec?: number;
  /** When set, merged as the only audio track (voiceover). */
  audioBuffer?: ArrayBuffer;
  /** Per-slide duration in seconds (from TTS alignment). When set, voice is synced to slide changes. */
  slideDurationsSec?: number[];
  /** Cathy-style caption cues (1–3 words each). Burned in with fontfile. */
  captionCues?: CaptionCue[];
  /** Where to draw captions. */
  captionPosition?: CaptionPosition;
  /** Optional step label callback for UI progress (e.g. "Preparing…", "Encoding video…"). */
  onStep?: (step: string) => void;
};

function secToSrtTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

function captionCuesToSrt(cues: CaptionCue[]): string {
  return cues
    .map((c, i) => {
      const text = c.text.replace(/\r?\n/g, " ").trim();
      if (!text) return "";
      return `${i + 1}\n${secToSrtTime(c.start)} --> ${secToSrtTime(c.end)}\n${text}\n`;
    })
    .filter(Boolean)
    .join("\n");
}

/** Render a single caption as a PNG (text on transparent background) for overlay. Runs in browser. */
function renderCaptionToPng(
  text: string,
  videoWidth: number,
  videoHeight: number,
  _position: CaptionPosition = "bottom_center"
): Uint8Array {
  const stripH = Math.max(72, Math.round(videoHeight * 0.1));
  const cw = videoWidth;
  const ch = stripH;
  const canvas =
    typeof document !== "undefined"
      ? document.createElement("canvas")
      : (null as unknown as HTMLCanvasElement);
  if (!canvas) return new Uint8Array(0);
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new Uint8Array(0);
  ctx.clearRect(0, 0, cw, ch);
  const fontSize = Math.max(22, Math.round(videoHeight * 0.032));
  ctx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const x = cw / 2;
  const y = ch / 2;
  ctx.strokeStyle = "black";
  ctx.lineWidth = 4;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = "white";
  ctx.fillText(text, x, y);
  const dataUrl = canvas.toDataURL("image/png");
  const base64 = dataUrl.split(",")[1];
  if (!base64) return new Uint8Array(0);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Escape caption text for FFmpeg drawtext (single-quoted value: ' -> '\''). */
function escapeDrawtext(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "'\\''");
}

const MAX_CAPTION_CUES = 80; // Avoid filter_complex length limits in browser

/** TTF font URLs for drawtext (FFmpeg.wasm requires fontfile). TTF only, no woff2. */
const CAPTION_FONT_URLS = [
  "/fonts/caption-font.ttf",
  "https://cdn.jsdelivr.net/npm/@fontsource/roboto@5.0.8/files/roboto-latin-400-normal.ttf",
  "https://raw.githubusercontent.com/google/fonts/main/apache/roboto/static/Roboto-Regular.ttf",
];

/** Build drawtext filter chain. Positions avoid platform UI: TikTok/Reels use bottom 20–35% for buttons; center and safe_lower stay in safe zones. */
function buildCaptionDrawtextChain(
  inputLabel: string,
  outputLabel: string,
  cues: CaptionCue[],
  width: number,
  height: number,
  fontFile: string,
  position: CaptionPosition = "bottom_center"
): string[] {
  const lines: string[] = [];
  let prev = inputLabel;
  const fontSize = Math.max(22, Math.round(height * 0.032));
  const capped = cues.slice(0, MAX_CAPTION_CUES);
  const fontfileParam = `fontfile=${fontFile}`;
  const marginV = Math.round(height * 0.06);
  // center = middle (safe). safe_lower = above bottom 35% (TikTok/Reels UI). lower_third = 72% from top. bottom_center = from bottom.
  const yExpr =
    position === "center"
      ? "(h-th)/2"
      : position === "safe_lower"
        ? String(Math.round(height * 0.58))
        : position === "lower_third"
          ? String(Math.round(height * 0.72))
          : `h-th-${marginV}`;
  // Avoid box= (can be flaky in FFmpeg.wasm); use border for visibility
  const borderParam = "borderw=3:bordercolor=black";
  for (let i = 0; i < capped.length; i++) {
    const c = capped[i]!;
    const text = c.text.replace(/\r?\n/g, " ").trim();
    if (!text) continue;
    const next = i === capped.length - 1 ? outputLabel : `cap_${i}`;
    const escaped = escapeDrawtext(text);
    const enable = `between(t,${c.start.toFixed(2)},${c.end.toFixed(2)})`;
    lines.push(
      `[${prev}]drawtext=${fontfileParam}:text='${escaped}':enable='${enable}':x=(w-text_w)/2:y=${yExpr}:fontsize=${fontSize}:fontcolor=white:${borderParam}[${next}]`
    );
    prev = next;
  }
  return lines;
}

/** Fetch a TTF font for drawtext. Returns buffer or null. FFmpeg.wasm needs TTF (not woff2). */
async function fetchCaptionFont(): Promise<ArrayBuffer | null> {
  for (const url of CAPTION_FONT_URLS) {
    try {
      const res = await fetch(url, { cache: "default" });
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      if (buf.byteLength < 1000) continue;
      return buf;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Create MP4 from layered slides: backgrounds cycle (Ken Burns) per slide, overlay (text/chrome) stays on top with fade-in.
 * Use when export provides slideVideoData (backgroundUrls + overlayUrl per slide).
 * With options.audioBuffer = voiceover and options.minDurationSec = 30: images-only feel, min 30s, with speech.
 */
export async function createVideoFromLayeredSlides(
  slides: LayeredSlideInput[],
  width: number,
  height: number,
  onProgress?: (p: number) => void,
  options?: CreateVideoOptions
): Promise<Blob> {
  options?.onStep?.("Preparing…");
  const ffmpeg = await getFFmpeg();
  ffmpeg.on("progress", ({ progress }) => {
    onProgress?.(Math.min(1, progress));
  });

  const n = slides.length;
  if (n === 0) throw new Error("No slides");

  const minDurationSec = options?.minDurationSec ?? 0;
  const slideDurationsSec = options?.slideDurationsSec;
  const hasVoiceover = !!options?.audioBuffer;
  let secPerSlideArray: number[] =
    slideDurationsSec && slideDurationsSec.length === n
      ? slideDurationsSec.map((d) => Math.max(0.5, d))
      : Array(n).fill(
          minDurationSec > 0
            ? Math.max(SECONDS_PER_SLIDE, minDurationSec / n)
            : SECONDS_PER_SLIDE
        );

  // With voiceover: (1) scale for xfade; (2) sync factor so slides hold slightly longer and
  // match the voice (images were coming in a little fast); (3) extend last slide so
  // -shortest trims only the extension and the last frame stays on till the video ends.
  if (hasVoiceover && slideDurationsSec && slideDurationsSec.length === n) {
    const totalAudioSec = secPerSlideArray.reduce((a, b) => a + b, 0);
    const overlapSec = (n - 1) * FADE_DURATION_SEC;
    if (totalAudioSec > 0.01 && overlapSec >= 0) {
      // Sync: slides hold ~2% longer so transitions align with voice.
      const syncFactor = 1.02;
      const scale = (totalAudioSec * syncFactor + overlapSec) / totalAudioSec;
      secPerSlideArray = secPerSlideArray.map((d) => Math.max(0.5, d * scale));
      // Extra hold on last frame so it stays visible till video end; -shortest will trim this.
      const lastFrameHoldSec = 0.35;
      const trimAmount = totalAudioSec * (syncFactor - 1) + lastFrameHoldSec;
      secPerSlideArray[n - 1] = (secPerSlideArray[n - 1] ?? 0) + trimAmount;
    }
  }

  const scale = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`;
  const x264Args = ["-preset", "veryfast", "-crf", "20"];

  // Per-slide: K = number of background segments (1..MAX_BACKGROUNDS_PER_SLIDE)
  const K: number[] = slides.map((s) =>
    Math.min(Math.max(1, s.backgroundUrls.length), MAX_BACKGROUNDS_PER_SLIDE)
  );
  const hasOverlay: boolean[] = slides.map((s) => !!s.overlayUrl);

  if (options?.audioBuffer) {
    await ffmpeg.writeFile("voiceover.mp3", new Uint8Array(options.audioBuffer));
  }
  const captionCuesFiltered = (options?.captionCues ?? []).filter((c) => c.text.replace(/\s/g, "").length > 0);
  const captionPosition = options?.captionPosition ?? "bottom_center";
  if (captionCuesFiltered.length > 0 && options?.captionCues) {
    const srt = captionCuesToSrt(options.captionCues);
    await ffmpeg.writeFile("captions.srt", new TextEncoder().encode(srt));
  }

  options?.onStep?.("Loading images…");
  // Fetch and write all assets (same order as inputArgs below)
  for (let i = 0; i < n; i++) {
    const urls = slides[i]!.backgroundUrls;
    const count = K[i]!;
    for (let k = 0; k < count; k++) {
      const url = urls[k % urls.length];
      if (!url) throw new Error(`Missing background URL for slide ${i + 1}, image ${k + 1}`);
      const res = await fetch(url, { mode: "cors" });
      if (!res.ok) throw new Error(`Failed to fetch background ${i + 1}/${k + 1}`);
      const buf = await res.arrayBuffer();
      await ffmpeg.writeFile(`bg_${i}_${k}.png`, new Uint8Array(buf));
    }
    if (hasOverlay[i] && slides[i]!.overlayUrl) {
      const res = await fetch(slides[i]!.overlayUrl!, { mode: "cors" });
      if (!res.ok) throw new Error(`Failed to fetch overlay ${i + 1}`);
      const buf = await res.arrayBuffer();
      await ffmpeg.writeFile(`overlay_${i}.png`, new Uint8Array(buf));
    }
  }

  // Build inputArgs and bgInputIndices in a single pass so indices always match the actual -i order.
  const inputArgs: string[] = [];
  const bgInputIndices: number[][] = [];
  const overlayInputIndices: (number | null)[] = [];
  let videoInputIndex = 0;
  for (let i = 0; i < n; i++) {
    const secSlide = secPerSlideArray[i]!;
    const secPerBg = secSlide / K[i]!;
    const indices: number[] = [];
    for (let k = 0; k < K[i]!; k++) {
      indices.push(videoInputIndex);
      inputArgs.push(
        "-loop", "1",
        "-t", String(secPerBg),
        "-framerate", String(OUTPUT_FPS),
        "-i", `bg_${i}_${k}.png`
      );
      videoInputIndex++;
    }
    bgInputIndices.push(indices);
    if (hasOverlay[i]) {
      overlayInputIndices.push(videoInputIndex);
      inputArgs.push(
        "-loop", "1",
        "-t", String(secSlide),
        "-framerate", String(OUTPUT_FPS),
        "-i", `overlay_${i}.png`
      );
      videoInputIndex++;
    } else {
      overlayInputIndices.push(null);
    }
  }
  const slideVideoInputCount = videoInputIndex;

  // Caption-as-overlay: render each cue as a PNG and overlay with enable=between(t,...).
  type WrittenCaption = { ffmpegIndex: number; fileIndex: number; cue: CaptionCue };
  const writtenCaptions: WrittenCaption[] = [];
  if (captionCuesFiltered.length > 0 && typeof document !== "undefined") {
    const capped = captionCuesFiltered.slice(0, MAX_CAPTION_CUES);
    let fileIndex = 0;
    for (let i = 0; i < capped.length; i++) {
      const c = capped[i]!;
      const text = c.text.replace(/\r?\n/g, " ").trim();
      if (!text) continue;
      const png = renderCaptionToPng(text, width, height, captionPosition);
      if (png.length > 0) {
        await ffmpeg.writeFile(`cap_${fileIndex}.png`, png);
        writtenCaptions.push({ ffmpegIndex: videoInputIndex + writtenCaptions.length, fileIndex, cue: c });
        fileIndex++;
      }
    }
  }
  for (let i = 0; i < writtenCaptions.length; i++) {
    const { fileIndex, cue } = writtenCaptions[i]!;
    const dur = Math.max(0.1, cue.end - cue.start);
    inputArgs.push("-loop", "1", "-t", String(dur), "-framerate", String(OUTPUT_FPS), "-i", `cap_${fileIndex}.png`);
  }
  if (options?.audioBuffer) {
    inputArgs.push("-i", "voiceover.mp3");
  }
  const totalInputs = videoInputIndex + writtenCaptions.length;

  const filters: string[] = [];
  const slideBgLabels: string[] = [];

  for (let i = 0; i < n; i++) {
    const ki = K[i]!;
    const secSlide = secPerSlideArray[i]!;
    const secPerBg = secSlide / ki;
    const framesPerBg = Math.round(secPerBg * OUTPUT_FPS);
    const indices = bgInputIndices[i]!;

    // Zoom + pan (both axes) on every segment so the image never looks still (no "stuck" feel).
    const zoomRange = 0.14; // 1.0 -> 1.14
    const panPct = 0.08; // 8% of frame per axis
    for (let k = 0; k < ki; k++) {
      const idx = indices[k]!;
      const inLabel = `${idx}:v`;
      const scaled = `sb_${i}_${k}`;
      const zoomIn = k % 2 === 0;
      const zExpr = zoomIn
        ? `'min(1+${zoomRange}*on/${framesPerBg},1+${zoomRange})'`
        : `'max(1+${zoomRange}-${zoomRange}*on/${framesPerBg},1)'`;
      const dir = (i + k) % 4; // 0=right+down, 1=left+up, 2=right+up, 3=left+down (diagonal pan)
      const xPos = dir === 0 || dir === 2;
      const yPos = dir === 0 || dir === 3;
      const xExpr = xPos
        ? `'iw/2-(iw/zoom/2)+iw*${panPct}*on/${framesPerBg}'`
        : `'iw/2-(iw/zoom/2)-iw*${panPct}*on/${framesPerBg}'`;
      const yExpr = yPos
        ? `'ih/2-(ih/zoom/2)+ih*${panPct}*on/${framesPerBg}'`
        : `'ih/2-(ih/zoom/2)-ih*${panPct}*on/${framesPerBg}'`;
      filters.push(`[${inLabel}]${scale}[${scaled}]`);
      filters.push(`[${scaled}]zoompan=z=${zExpr}:x=${xExpr}:y=${yExpr}:d=1:s=${width}x${height}:fps=${OUTPUT_FPS}[zp_${i}_${k}]`);
      filters.push(`[zp_${i}_${k}]format=yuv420p,fps=${OUTPUT_FPS}[zb_${i}_${k}]`);
    }

    let bgLabel: string;
    if (ki === 1) {
      bgLabel = `zb_${i}_0`;
      slideBgLabels.push(bgLabel);
    } else {
      // Use concat for all multi-image slides (FFmpeg.wasm xfade often freezes on 2nd input).
      // Hard cut between images; both segments get zoom/pan.
      const concatLabels = Array.from({ length: ki }, (_, k) => `zb_${i}_${k}`);
      const concatInputStr = concatLabels.map((l) => `[${l}]`).join("");
      filters.push(`${concatInputStr}concat=n=${ki}:v=1:a=0[bg_${i}]`);
      filters.push(`[bg_${i}]fps=${OUTPUT_FPS},format=yuv420p[bg_${i}_tb]`);
      bgLabel = `bg_${i}_tb`;
      slideBgLabels.push(bgLabel);
    }
  }

  const slideLabels: string[] = [];
  for (let i = 0; i < n; i++) {
    const bgLabel = slideBgLabels[i]!;
    if (hasOverlay[i]) {
      const ovIn = overlayInputIndices[i]!;
      filters.push(`[${ovIn}:v]fade=t=in:st=0:d=${OVERLAY_FADE_IN_SEC}:alpha=1,format=rgba[ov_${i}]`);
      filters.push(`[${bgLabel}][ov_${i}]overlay=0:0:format=auto[slide_${i}]`);
      slideLabels.push(`slide_${i}`);
    } else {
      slideLabels.push(bgLabel);
    }
  }

  // Chain slides with xfade (offset = when transition starts in first stream; must be >= 0)
  let prevLabel = slideLabels[0]!;
  let currentDurationSec = secPerSlideArray[0]!;
  for (let i = 1; i < n; i++) {
    const offset = Math.max(0, currentDurationSec - FADE_DURATION_SEC);
    const transition = SLIDE_TRANSITIONS[(i - 1) % SLIDE_TRANSITIONS.length];
    const outLabel = i === n - 1 ? "vlast" : `chain_${i}`;
    filters.push(`[${prevLabel}][${slideLabels[i]}]xfade=transition=${transition}:duration=${FADE_DURATION_SEC.toFixed(2)}:offset=${offset.toFixed(2)}[${outLabel}]`);
    prevLabel = outLabel;
    currentDurationSec += Math.max(0.1, secPerSlideArray[i]! - FADE_DURATION_SEC);
  }

  const lastVideoLabel = n === 1 ? slideLabels[0]! : "vlast";
  // Normalize to yuv420p so overlay/captions get a consistent base (helps FFmpeg.wasm with multi-slide chains)
  filters.push(`[${lastVideoLabel}]format=yuv420p,fps=${OUTPUT_FPS}[vbase]`);
  const videoBaseLabel = "vbase";

  const hasCaptions = captionCuesFiltered.length > 0;
  let captionMethod: "overlay" | "drawtext" | "subtitles" | null = null;
  if (hasCaptions && writtenCaptions.length > 0) {
    captionMethod = "overlay";
  } else if (hasCaptions) {
    const fontBuf = await fetchCaptionFont();
    if (fontBuf) {
      await ffmpeg.writeFile("font.ttf", new Uint8Array(fontBuf));
      captionMethod = "drawtext";
    } else {
      captionMethod = "subtitles";
    }
  }
  const marginV = Math.round(height * 0.06);
  const captionY = captionPosition === "center" ? "(H-h)/2" : captionPosition === "lower_third" ? String(Math.round(height * 0.72)) : captionPosition === "safe_lower" ? String(Math.round(height * 0.58)) : `H-h-${marginV}`;
  if (hasCaptions && captionMethod === "overlay") {
    let prevLabel = videoBaseLabel;
    for (let j = 0; j < writtenCaptions.length; j++) {
      const { ffmpegIndex, fileIndex, cue } = writtenCaptions[j]!;
      const enable = `between(t,${cue.start.toFixed(2)},${cue.end.toFixed(2)})`;
      const outLabel = j === writtenCaptions.length - 1 ? "vsub" : `vc_${j}`;
      filters.push(`[${prevLabel}][${ffmpegIndex}:v]overlay=x=(W-w)/2:y=${captionY}:enable='${enable}':format=auto[${outLabel}]`);
      prevLabel = outLabel;
    }
    filters.push("[vsub]format=yuv420p[vout]");
  } else if (hasCaptions && captionMethod === "drawtext") {
    const captionFilters = buildCaptionDrawtextChain(
      videoBaseLabel,
      "vsub",
      captionCuesFiltered,
      width,
      height,
      "font.ttf",
      captionPosition
    );
    if (captionFilters.length > 0) {
      filters.push(...captionFilters);
      filters.push("[vsub]format=yuv420p[vout]");
    } else {
      filters.push(`[${videoBaseLabel}]format=yuv420p[vout]`);
    }
  } else if (hasCaptions && captionMethod === "subtitles") {
    filters.push(`[${videoBaseLabel}]subtitles=captions.srt[vsub]`);
    filters.push("[vsub]format=yuv420p[vout]");
  } else {
    filters.push(`[${videoBaseLabel}]format=yuv420p[vout]`);
  }

  const filterComplex = filters.join(";");
  const audioInputIndex = totalInputs; // voiceover.mp3 is last input when present
  const args = options?.audioBuffer
    ? [
        ...inputArgs,
        "-filter_complex", filterComplex,
        "-map", "[vout]",
        "-map", `${audioInputIndex}:a:0`,
        "-c:v", "libx264",
        "-c:a", "aac",
        "-shortest",
        ...x264Args,
        "output.mp4",
      ]
    : [
        ...inputArgs,
        "-filter_complex", filterComplex,
        "-map", "[vout]",
        "-c:v", "libx264",
        ...x264Args,
        "output.mp4",
      ];

  const execLogs: string[] = [];
  const logHandler = (e: unknown) => {
    const msg = typeof e === "object" && e !== null && "message" in e ? String((e as { message: string }).message) : String(e);
    execLogs.push(msg);
  };
  ffmpeg.on("log", logHandler);
  options?.onStep?.("Encoding video…");
  let exitCode: number;
  try {
    exitCode = await ffmpeg.exec(args);
  } finally {
    try {
      (ffmpeg as unknown as { off?: (event: string, fn: (e: unknown) => void) => void }).off?.("log", logHandler);
    } catch {
      /* ignore */
    }
  }
  if (exitCode !== 0) {
    const tail = execLogs.slice(-12).join(" ");
    throw new Error(tail ? `FFmpeg encoding failed: ${tail}` : "FFmpeg encoding failed");
  }

  options?.onStep?.("Finalizing…");
  const data = await ffmpeg.readFile("output.mp4");
  const bytes =
    data instanceof Uint8Array
      ? data
      : typeof data === "string"
        ? new Uint8Array(Uint8Array.from(atob(data), (c) => c.charCodeAt(0)))
        : new Uint8Array(data as ArrayBuffer);
  const blob = new Blob([new Uint8Array(bytes)], { type: "video/mp4" });

  for (let i = 0; i < n; i++) {
    for (let k = 0; k < K[i]!; k++) {
      try { await ffmpeg.deleteFile(`bg_${i}_${k}.png`); } catch { /* ignore */ }
    }
    if (hasOverlay[i]) {
      try { await ffmpeg.deleteFile(`overlay_${i}.png`); } catch { /* ignore */ }
    }
  }
  if (options?.audioBuffer) {
    try { await ffmpeg.deleteFile("voiceover.mp3"); } catch { /* ignore */ }
  }
  if (hasCaptions) {
    try { await ffmpeg.deleteFile("captions.srt"); } catch { /* ignore */ }
  }
  if (captionMethod === "overlay") {
    for (const w of writtenCaptions) {
      try { await ffmpeg.deleteFile(`cap_${w.fileIndex}.png`); } catch { /* ignore */ }
    }
  }
  if (captionMethod === "drawtext") {
    try { await ffmpeg.deleteFile("font.ttf"); } catch { /* ignore */ }
  }
  try { await ffmpeg.deleteFile("output.mp4"); } catch { /* ignore */ }

  return blob;
}
