import { query, queryMany, queryOne } from "./pg";

type EmailSubscription = {
  email: string;
  weekly_creator_note: boolean;
  last_weekly_creator_note_at: string | null;
};

export async function getWeeklyCreatorNotePreference(email: string): Promise<boolean> {
  const row = await queryOne<EmailSubscription>(
    "select email, weekly_creator_note, last_weekly_creator_note_at from email_subscriptions where email = $1",
    [email.toLowerCase()]
  );
  return row?.weekly_creator_note ?? false;
}

export async function setWeeklyCreatorNotePreference(email: string, enabled: boolean) {
  await query(
    `insert into email_subscriptions (email, weekly_creator_note, unsubscribed_at)
     values ($1, $2, case when $2 then null else now() end)
     on conflict (email) do update set weekly_creator_note = excluded.weekly_creator_note,
       unsubscribed_at = excluded.unsubscribed_at, updated_at = now()`,
    [email.toLowerCase(), enabled]
  );
}

/** Adds a configured launch recipient once, but never re-subscribes someone who opted out. */
export async function addWeeklyCreatorNoteRecipientIfNew(email: string) {
  await query(
    `insert into email_subscriptions (email, weekly_creator_note)
     values ($1, true)
     on conflict (email) do nothing`,
    [email.toLowerCase()]
  );
}

export async function listWeeklyCreatorNoteRecipients(limit = 100): Promise<EmailSubscription[]> {
  return queryMany<EmailSubscription>(
    `select email, weekly_creator_note, last_weekly_creator_note_at
     from email_subscriptions
     where weekly_creator_note = true
       and (last_weekly_creator_note_at is null or last_weekly_creator_note_at < date_trunc('week', now()))
     order by updated_at asc
     limit $1`,
    [limit]
  );
}

export async function markWeeklyCreatorNoteSent(email: string) {
  await query(
    "update email_subscriptions set last_weekly_creator_note_at = now(), updated_at = now() where email = $1",
    [email.toLowerCase()]
  );
}
