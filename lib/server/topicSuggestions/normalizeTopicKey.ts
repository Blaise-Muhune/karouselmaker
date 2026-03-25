export function normalizeTopicKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[""''`]/g, "")
    .slice(0, 200);
}
