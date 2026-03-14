import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Build a safe filename slug from a title (e.g. carousel or project name). */
export function slugifyForFilename(title: string): string {
  const s = String(title ?? "").trim();
  if (!s) return "";
  const slug = s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[\s_]+/g, "-")
    .replace(/[^\w.-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "";
}
