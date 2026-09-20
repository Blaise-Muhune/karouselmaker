/** Allowlisted post-login return paths for the Digilaine handoff. */
export function safeAuthNext(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\")) {
    return null;
  }
  const path = trimmed.split("?")[0]?.split("#")[0] ?? "";
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://")) {
    return null;
  }
  if (path === "/from/digilaine" || path === "/from/digilaine/continue") {
    return "/from/digilaine/continue";
  }
  return null;
}
