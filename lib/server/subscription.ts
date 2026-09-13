"use server";

import { getProfile } from "@/lib/server/db/profiles";
import { countCarouselsLifetime } from "@/lib/server/db/carousels";
import type { PaidPlan } from "@/lib/server/db/types";
import { PLAN_LIMITS, TESTER_EMAILS, FREE_FULL_ACCESS_GENERATIONS, type PlanLimits } from "@/lib/constants";

export type Subscription = {
  plan: "free" | PaidPlan;
  /** True when on Creator or Growth. */
  isPro: boolean;
};

function planFromProfileRow(raw: string | undefined | null): Subscription["plan"] {
  if (raw === "creator" || raw === "starter") return "creator";
  if (raw === "growth" || raw === "pro" || raw === "studio") return "growth";
  return "free";
}

/**
 * Returns subscription for the user. Pass user email to grant tester benefits
 * (paid access + tester limits) for configured tester emails.
 */
export async function getSubscription(
  userId: string,
  email?: string | null
): Promise<Subscription> {
  if (TESTER_EMAILS.includes(email ?? "")) return { plan: "growth", isPro: true };
  const profile = await getProfile(userId);
  const plan = planFromProfileRow(profile?.plan);
  return { plan, isPro: plan !== "free" };
}

/**
 * Returns effective plan limits for the user. Pass user email so testers get
 * high QA limits.
 */
export async function getPlanLimits(
  userId: string,
  email?: string | null
): Promise<PlanLimits> {
  if (TESTER_EMAILS.includes(email ?? "")) return PLAN_LIMITS.tester;
  const { plan } = await getSubscription(userId, email);
  if (plan === "free") return PLAN_LIMITS.free;
  return PLAN_LIMITS[plan];
}

/**
 * True for paying users, testers, or free users who have created fewer than
 * {@link FREE_FULL_ACCESS_GENERATIONS} carousels (full paid feature access, not admin).
 */
export async function hasFullProFeatureAccess(
  userId: string,
  email?: string | null
): Promise<boolean> {
  if (TESTER_EMAILS.includes(email ?? "")) return true;
  const { isPro } = await getSubscription(userId, email);
  if (isPro) return true;
  const lifetimeCount = await countCarouselsLifetime(userId);
  return lifetimeCount < FREE_FULL_ACCESS_GENERATIONS;
}

/**
 * Paid users get their tier’s limits. Free users in the first N lifetime carousels get Growth-tier
 * quotas. Everyone else gets free limits.
 */
export async function getEffectivePlanLimits(
  userId: string,
  email?: string | null
): Promise<PlanLimits> {
  if (TESTER_EMAILS.includes(email ?? "")) return PLAN_LIMITS.tester;
  const subscription = await getSubscription(userId, email);
  if (subscription.isPro) {
    return PLAN_LIMITS[subscription.plan];
  }
  const lifetimeCount = await countCarouselsLifetime(userId);
  if (lifetimeCount < FREE_FULL_ACCESS_GENERATIONS) {
    return PLAN_LIMITS.growth;
  }
  return PLAN_LIMITS.free;
}

/** Editing an existing carousel and downloading it never consume a post pack. */
export async function requirePro(
  userId: string,
  email?: string | null
): Promise<{ allowed: boolean; error?: string }> {
  void userId;
  void email;
  return { allowed: true };
}
