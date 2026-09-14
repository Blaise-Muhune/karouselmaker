import { Resend } from "resend";

type TransactionalEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  idempotencyKey?: string;
  headers?: Record<string, string>;
};

function emailConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  return { apiKey, from };
}

/**
 * Sends a product email only when a verified sender and Resend key are configured.
 * Callers should treat delivery as best-effort unless the email is part of a required flow.
 */
export async function sendTransactionalEmail({
  to,
  subject,
  html,
  text,
  replyTo,
  idempotencyKey,
  headers,
}: TransactionalEmail): Promise<{ sent: true } | { sent: false; reason: string }> {
  const { apiKey, from } = emailConfig();
  if (!apiKey || !from) return { sent: false, reason: "Email is not configured." };

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: [to],
    subject,
    html,
    text,
    ...(replyTo ? { replyTo } : {}),
    ...((idempotencyKey || headers)
      ? { headers: { ...headers, ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) } }
      : {}),
  });

  if (error) return { sent: false, reason: error.message || "Email provider rejected the message." };
  return { sent: true };
}

export function escapeEmailHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
