"use server";

import { getProfile } from "@/lib/server/db/profiles";
import type { Plan } from "@/lib/server/db/types";
import { PLAN_LIMITS, TESTER_EMAIL } from "@/lib/constants";

export type Subscription = {
  plan: Plan;
  isPro: boolean;
};

/** Limits for a plan (free, pro, or tester). */
export type PlanLimits = (typeof PLAN_LIMITS)[keyof typeof PLAN_LIMITS];

/**
 * Returns subscription for the user. Pass user email to grant tester benefits
 * (isPro true + tester limits) for muyumba@andrews.edu.
 */
export async function getSubscription(
  userId: string,
  email?: string | null
): Promise<Subscription> {
  if (email === TESTER_EMAIL) return { plan: "pro", isPro: true };
  const profile = await getProfile(userId);
  const plan = (profile?.plan === "pro" ? "pro" : "free") as Plan;
  return { plan, isPro: plan === "pro" };
}

/**
 * Returns effective plan limits for the user. Pass user email so testers get
 * 500 carousels/month and 2× pro limits for assets, exports, and custom templates.
 */
export async function getPlanLimits(
  userId: string,
  email?: string | null
): Promise<PlanLimits> {
  if (email === TESTER_EMAIL) return PLAN_LIMITS.tester;
  const { plan } = await getSubscription(userId, email);
  return PLAN_LIMITS[plan];
}

export async function requirePro(
  userId: string,
  email?: string | null
): Promise<{ allowed: boolean; error?: string }> {
  const { isPro } = await getSubscription(userId, email);
  if (isPro) return { allowed: true };
  return { allowed: false, error: "Upgrade to Pro to edit slides and export." };
}
