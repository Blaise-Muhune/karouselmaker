"use server";

import { getUser } from "@/lib/server/auth/getUser";
import { escapeEmailHtml, sendTransactionalEmail } from "@/lib/server/email/transactional";

const CONTACT_EMAIL = process.env.CONTACT_EMAIL;
const MAX_MESSAGE_LENGTH = 5_000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function sendContactMessage(formData: FormData) {
  const title = (formData.get("title") as string)?.trim().slice(0, 200) || undefined;
  const body = (formData.get("body") as string)?.trim().slice(0, MAX_MESSAGE_LENGTH);
  const senderEmail = (formData.get("senderEmail") as string)?.trim();
  const senderName = (formData.get("senderName") as string)?.trim();

  if (!body) {
    return { error: "Message is required." };
  }
  if (!CONTACT_EMAIL) {
    console.error("CONTACT_EMAIL is not set");
    return { error: "Contact form is not configured. Please try again later." };
  }

  const subject = title
    ? `[KarouselMaker Contact] ${title}`
    : "[KarouselMaker Contact] New message";

  // Never trust the hidden client-side email field for an authenticated user.
  // It would otherwise let a caller impersonate another customer in the support inbox.
  const { user } = await getUser();
  const authenticatedEmail = user?.email?.trim();
  const replyTo = authenticatedEmail || (senderEmail && EMAIL_PATTERN.test(senderEmail) ? senderEmail : undefined);
  const metadataName = user?.user_metadata?.full_name;
  const displayName = typeof metadataName === "string" ? metadataName : senderName;
  const fromDisplay =
    displayName && replyTo
      ? `${escapeEmailHtml(displayName)} &lt;${escapeEmailHtml(replyTo)}&gt;`
      : displayName || replyTo || "";
  const senderInfo = fromDisplay
    ? `<p style="margin-top:1rem;color:#666;font-size:0.875rem;">From: ${fromDisplay}</p>`
    : "";
  const safeBody = escapeEmailHtml(body).replace(/\n/g, "<br>");
  const htmlBody = `<div style="font-family:Arial,sans-serif;line-height:1.5">${safeBody}${senderInfo}</div>`;

  const delivery = await sendTransactionalEmail({
    to: CONTACT_EMAIL,
    replyTo,
    subject,
    html: htmlBody,
    text: [body, replyTo ? `From: ${replyTo}` : ""].filter(Boolean).join("\n\n"),
  });

  if (!delivery.sent) {
    console.error("Contact form error:", delivery.reason);
    return { error: "Failed to send message. Please try again." };
  }

  // Acknowledgements go only to the verified email on the signed-in session.
  // Do not turn the public contact form into a way to email arbitrary recipients.
  if (authenticatedEmail) {
    const safeTitle = title ? ` about “${escapeEmailHtml(title)}”` : "";
    const acknowledgment = await sendTransactionalEmail({
      to: authenticatedEmail,
      subject: "We received your KarouselMaker message",
      replyTo: CONTACT_EMAIL,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#132019"><p>Thanks for contacting KarouselMaker.</p><p>We received your message${safeTitle} and will reply as soon as we can.</p></div>`,
      text: `Thanks for contacting KarouselMaker. We received your message${title ? ` about “${title}”` : ""} and will reply as soon as we can.`,
    });
    if (!acknowledgment.sent) console.error("Contact acknowledgement error:", acknowledgment.reason);
  }

  return { success: true };
}
