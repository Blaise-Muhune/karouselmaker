"use server";

import { Resend } from "resend";

const CONTACT_EMAIL = process.env.CONTACT_EMAIL || "blaisemu007@gmail.com";
// After verifying a domain at resend.com/domains, set e.g. "KarouselMaker <noreply@yourdomain.com>"
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "KarouselMaker <onboarding@resend.dev>";

export async function sendContactMessage(formData: FormData) {
  const title = (formData.get("title") as string)?.trim() || undefined;
  const body = (formData.get("body") as string)?.trim();
  const senderEmail = (formData.get("senderEmail") as string)?.trim();
  const senderName = (formData.get("senderName") as string)?.trim();

  if (!body) {
    return { error: "Message is required." };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY is not set");
    return { error: "Contact form is not configured. Please try again later." };
  }

  const resend = new Resend(apiKey);

  const subject = title
    ? `[KarouselMaker Contact] ${title}`
    : "[KarouselMaker Contact] New message";

  const fromDisplay =
    senderName && senderEmail
      ? `${senderName} &lt;${senderEmail}&gt;`
      : senderName || senderEmail || "";
  const senderInfo = fromDisplay
    ? `<p style="margin-top:1rem;color:#666;font-size:0.875rem;">From: ${fromDisplay}</p>`
    : "";
  const htmlBody = [body, senderInfo].filter(Boolean).join("");

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: [CONTACT_EMAIL],
    replyTo: senderEmail || undefined,
    subject,
    html: htmlBody.replace(/\n/g, "<br>"),
  });

  if (error) {
    console.error("Contact form error:", error);
    const isResendValidation =
      error.message?.includes("only send testing emails to your own email") ||
      error.message?.includes("verify a domain");
    if (isResendValidation) {
      return {
        error: "Contact form is being set up. Please try again later.",
      };
    }
    return { error: "Failed to send message. Please try again." };
  }

  return { success: true };
}
