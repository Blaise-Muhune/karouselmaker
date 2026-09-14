import { NextResponse } from "next/server";
import { addWeeklyCreatorNoteRecipientIfNew, listWeeklyCreatorNoteRecipients, markWeeklyCreatorNoteSent } from "@/lib/server/db/emailSubscriptions";
import { weeklyCreatorNoteEmail } from "@/lib/server/email/messages";
import { signedUnsubscribeUrl } from "@/lib/server/email/preferences";
import { sendTransactionalEmail } from "@/lib/server/email/transactional";

export const maxDuration = 60;

function configuredRecipients() {
  return (process.env.WEEKLY_CREATOR_NOTE_BOOTSTRAP_RECIPIENTS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.EMAIL_PREFERENCE_SECRET) {
    return NextResponse.json({ error: "EMAIL_PREFERENCE_SECRET is not configured" }, { status: 500 });
  }

  for (const email of configuredRecipients()) {
    await addWeeklyCreatorNoteRecipientIfNew(email);
  }

  const recipients = await listWeeklyCreatorNoteRecipients();
  let sent = 0;
  const failures: string[] = [];
  const week = new Date().toISOString().slice(0, 10);
  for (const recipient of recipients) {
    const unsubscribeUrl = signedUnsubscribeUrl(recipient.email);
    if (!unsubscribeUrl) return NextResponse.json({ error: "Could not create unsubscribe link" }, { status: 500 });
    const message = weeklyCreatorNoteEmail(unsubscribeUrl);
    const result = await sendTransactionalEmail({
      to: recipient.email,
      ...message,
      replyTo: process.env.CONTACT_EMAIL,
      idempotencyKey: `weekly-creator-note:${week}:${recipient.email}`,
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
    if (result.sent) {
      await markWeeklyCreatorNoteSent(recipient.email);
      sent += 1;
    } else {
      failures.push(result.reason);
    }
  }

  return NextResponse.json({ sent, skipped: recipients.length - sent, failures });
}
