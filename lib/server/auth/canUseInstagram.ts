import { isAdmin } from "./isAdmin";

/**
 * Instagram posting is limited until Meta approves the app.
 * Admins always have access; INSTAGRAM_ACCESS_EMAILS (comma-separated) adds non-admin users
 * such as Meta app reviewers without giving them admin rights.
 */
export function canUseInstagram(email: string | null | undefined): boolean {
  if (isAdmin(email)) return true;
  if (!email) return false;
  const allowed = (process.env.INSTAGRAM_ACCESS_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
}
