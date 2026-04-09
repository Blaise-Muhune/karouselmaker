"use server";

import { getProfile } from "@/lib/server/db/profiles";
import { countCarouselsLifetime } from "@/lib/server/db/carousels";
import type { Plan } from "@/lib/server/db/types";
import { PLAN_LIMITS, TESTER_EMAILS, FREE_FULL_ACCESS_GENERATIONS } from "@/lib/constants";

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
  if (TESTER_EMAILS.includes(email ?? "")) return { plan: "pro", isPro: true };
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
  if (TESTER_EMAILS.includes(email ?? "")) return PLAN_LIMITS.tester;
  const { plan } = await getSubscription(userId, email);
  return PLAN_LIMITS[plan];
}

/**
 * True for paying Pro, testers, or free users who have created fewer than
 * {@link FREE_FULL_ACCESS_GENERATIONS} carousels (full Pro feature access, not admin).
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
 * During the free full-access trial (first N carousels), use Pro quotas so behavior matches Pro.
 * Otherwise use the user's actual plan limits.
 */
export async function getEffectivePlanLimits(
  userId: string,
  email?: string | null
): Promise<PlanLimits> {
  if (TESTER_EMAILS.includes(email ?? "")) return PLAN_LIMITS.tester;
  const fullAccess = await hasFullProFeatureAccess(userId, email);
  if (fullAccess) return PLAN_LIMITS.pro;
  return PLAN_LIMITS.free;
}

/** Allow Pro or free users still within their 3 full-access generations. */
export async function requirePro(
  userId: string,
  email?: string | null
): Promise<{ allowed: boolean; error?: string }> {
  const ok = await hasFullProFeatureAccess(userId, email);
  if (ok) return { allowed: true };
  return { allowed: false, error: "Upgrade to Pro to edit carousels and export." };
}
