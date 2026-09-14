"use server";

import { getUser } from "@/lib/server/auth/getUser";
import { getWeeklyCreatorNotePreference, setWeeklyCreatorNotePreference } from "@/lib/server/db/emailSubscriptions";

export async function getWeeklyCreatorNoteSetting() {
  const { user } = await getUser();
  if (!user.email) return { enabled: false };
  return { enabled: await getWeeklyCreatorNotePreference(user.email) };
}

export async function updateWeeklyCreatorNoteSetting(enabled: boolean) {
  const { user } = await getUser();
  if (!user.email) return { error: "Your account does not have an email address." };
  await setWeeklyCreatorNotePreference(user.email, Boolean(enabled));
  return { enabled: Boolean(enabled) };
}
