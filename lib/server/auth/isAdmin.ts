/**
 * Admin users (e.g. can access /admin and create system templates).
 * Add emails to this list to grant admin rights.
 */
export const ADMIN_EMAILS: string[] = [
  "blaisemu007@gmail.com",
  "muyumba@andrews.edu",
];

export function isAdmin(email: string | null | undefined): boolean {
  if (!email || typeof email !== "string") return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}
