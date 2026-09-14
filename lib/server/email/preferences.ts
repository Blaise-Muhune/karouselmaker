import crypto from "node:crypto";

function preferenceSecret() {
  return process.env.EMAIL_PREFERENCE_SECRET?.trim();
}

export function signedUnsubscribeUrl(email: string): string | null {
  const secret = preferenceSecret();
  if (!secret) return null;
  const token = crypto.createHmac("sha256", secret).update(email.toLowerCase()).digest("hex");
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://karouselmaker.com").replace(/\/$/, "");
  return `${appUrl}/api/email/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`;
}

export function isValidUnsubscribeToken(email: string, token: string | null): boolean {
  const secret = preferenceSecret();
  if (!secret || !token) return false;
  const expected = crypto.createHmac("sha256", secret).update(email.toLowerCase()).digest("hex");
  if (token.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}
