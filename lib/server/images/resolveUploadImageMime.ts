/**
 * Mobile file pickers often send an empty or wrong `File.type`. Resolve a real MIME from
 * client hint, filename extension, or magic bytes so uploads still validate and process.
 */

const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

const EXT_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".heic": "image/heic",
  ".heif": "image/heif",
};

export function normalizeClientImageMime(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (t === "image/jpg") return "image/jpeg";
  return t;
}

function mimeFromFileName(name: string): string | null {
  const lower = name.toLowerCase();
  const dot = lower.lastIndexOf(".");
  if (dot < 0) return null;
  const ext = lower.slice(dot);
  return EXT_MAP[ext] ?? null;
}

/** Detect image format from file header (works when `File.type` is empty). */
export function sniffImageMimeType(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "image/png";
  }
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return "image/gif";
  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  if (buffer.toString("ascii", 4, 8) === "ftyp") {
    const brand = buffer.toString("ascii", 8, 12);
    const heicBrands = new Set([
      "heic",
      "heix",
      "hevc",
      "hevx",
      "mif1",
      "msf1",
      "heim",
      "heis",
      "avic",
      "heif",
    ]);
    if (heicBrands.has(brand)) return "image/heic";
  }
  return null;
}

export function resolveUploadImageMime(file: File, buffer: Buffer): string | null {
  const fromClient = normalizeClientImageMime(file.type);
  if (fromClient && ALLOWED.has(fromClient)) return fromClient;

  const fromName = mimeFromFileName(file.name);
  if (fromName && ALLOWED.has(fromName)) return fromName;

  const sniffed = sniffImageMimeType(buffer);
  if (sniffed && ALLOWED.has(sniffed)) return sniffed;

  return null;
}
