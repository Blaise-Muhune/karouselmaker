"use server";

import { getProfile } from "@/lib/server/db/profiles";
import type { Plan } from "@/lib/server/db/types";

export type Subscription = {
  plan: Plan;
  isPro: boolean;
};

export async function getSubscription(userId: string): Promise<Subscription> {
  const profile = await getProfile(userId);
  const plan = (profile?.plan === "pro" ? "pro" : "free") as Plan;
  return { plan, isPro: plan === "pro" };
}

export async function requirePro(userId: string): Promise<{ allowed: boolean; error?: string }> {
  const { isPro } = await getSubscription(userId);
  if (isPro) return { allowed: true };
  return { allowed: false, error: "Upgrade to Pro to edit slides and export." };
}
