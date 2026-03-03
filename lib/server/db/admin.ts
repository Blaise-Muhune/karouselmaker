"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

/** Count all users in Supabase Auth (source of truth). Paginates to get accurate total. */
async function countAuthUsers(supabase: SupabaseClient): Promise<number> {
  try {
    let total = 0;
    let page = 1;
    const perPage = 1000;
    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
      if (error) return 0;
      const n = data.users.length;
      total += n;
      if (n < perPage) break;
      page += 1;
    }
    return total;
  } catch {
    return 0;
  }
}

export type AdminUserRow = {
  id: string;
  email: string | null;
  name: string;
  plan: "free" | "pro" | null;
  createdAt: string | null;
};

/** List users with name and email for admin. Uses Auth + profiles; capped at 500. */
export async function getAdminUsers(): Promise<AdminUserRow[]> {
  const supabase = createAdminClient();
  const perPage = 1000;
  const maxUsers = 500;
  const rows: { id: string; email: string | null; user_metadata: Record<string, unknown>; created_at: string | null }[] = [];
  let page = 1;
  try {
    while (rows.length < maxUsers) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
      if (error) break;
      for (const u of data.users) {
        rows.push({
          id: u.id,
          email: u.email ?? null,
          user_metadata: (u.user_metadata as Record<string, unknown>) ?? {},
          created_at: u.created_at ?? null,
        });
        if (rows.length >= maxUsers) break;
      }
      if (data.users.length < perPage) break;
      page += 1;
    }
  } catch {
    return [];
  }

  const userIds = rows.map((r) => r.id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, display_name, plan")
    .in("user_id", userIds);
  const profileByUserId = new Map(
    (profiles ?? []).map((p) => [
      (p as { user_id: string; display_name: string | null; plan: string | null }).user_id,
      p as { display_name: string | null; plan: string | null },
    ])
  );

  return rows.map((u) => {
    const profile = profileByUserId.get(u.id);
    const meta = u.user_metadata ?? {};
    const name =
      (profile?.display_name?.trim()) ||
      (typeof meta.full_name === "string" && meta.full_name.trim()) ||
      (typeof meta.name === "string" && meta.name.trim()) ||
      "—";
    return {
      id: u.id,
      email: u.email ?? null,
      name,
      plan: (profile?.plan === "pro" ? "pro" : profile?.plan === "free" ? "free" : null) ?? null,
      createdAt: u.created_at,
    };
  });
}

export type AdminStats = {
  totalUsers: number;
  totalProjects: number;
  totalCarousels: number;
  totalSlides: number;
  totalExports: number;
  proUsers: number;
  freeUsers: number;
  carouselsLast7Days: { date: string; count: number }[];
  exportsLast7Days: { date: string; count: number }[];
  newUsersLast7Days: { date: string; count: number }[];
  carouselsLast30Days: { date: string; count: number }[];
  exportsLast30Days: { date: string; count: number }[];
  newUsersLast30Days: { date: string; count: number }[];
};

function dateRange(days: number): string[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const labels: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    labels.push(d.toISOString().slice(0, 10));
  }
  return labels;
}

function bucketByDay(rows: { created_at: string }[], dateLabels: string[]) {
  const buckets: Record<string, number> = {};
  dateLabels.forEach((d) => (buckets[d] = 0));
  rows.forEach((r) => {
    const d = r.created_at.slice(0, 10);
    if (buckets[d] !== undefined) buckets[d]++;
  });
  return dateLabels.map((date) => ({ date, count: buckets[date] ?? 0 }));
}

export async function getAdminStats(): Promise<AdminStats | null> {
  const supabase = createAdminClient();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

  const dateLabels7 = dateRange(7);
  const dateLabels30 = dateRange(30);

  const [
    authUsersResult,
    { count: totalProjects },
    { count: totalCarousels },
    { count: totalSlides },
    { count: totalExports },
    { count: proUsers },
    profiles7Res,
    carousels7Res,
    exports7Res,
    profiles30Res,
    carousels30Res,
    exports30Res,
  ] = await Promise.all([
    countAuthUsers(supabase),
    supabase.from("projects").select("*", { count: "exact", head: true }),
    supabase.from("carousels").select("*", { count: "exact", head: true }),
    supabase.from("slides").select("*", { count: "exact", head: true }),
    supabase.from("exports").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("plan", "pro"),
    supabase.from("profiles").select("created_at").gte("created_at", sevenDaysAgo.toISOString()),
    supabase.from("carousels").select("created_at").gte("created_at", sevenDaysAgo.toISOString()),
    supabase.from("exports").select("created_at").gte("created_at", sevenDaysAgo.toISOString()).eq("status", "ready"),
    supabase.from("profiles").select("created_at").gte("created_at", thirtyDaysAgo.toISOString()),
    supabase.from("carousels").select("created_at").gte("created_at", thirtyDaysAgo.toISOString()),
    supabase.from("exports").select("created_at").gte("created_at", thirtyDaysAgo.toISOString()).eq("status", "ready"),
  ]);

  const totalUsers = authUsersResult ?? 0;
  const freeUsers = totalUsers - (proUsers ?? 0);

  return {
    totalUsers: totalUsers ?? 0,
    totalProjects: totalProjects ?? 0,
    totalCarousels: totalCarousels ?? 0,
    totalSlides: totalSlides ?? 0,
    totalExports: totalExports ?? 0,
    proUsers: proUsers ?? 0,
    freeUsers,
    carouselsLast7Days: bucketByDay(carousels7Res.data ?? [], dateLabels7),
    exportsLast7Days: bucketByDay(exports7Res.data ?? [], dateLabels7),
    newUsersLast7Days: bucketByDay(profiles7Res.data ?? [], dateLabels7),
    carouselsLast30Days: bucketByDay(carousels30Res.data ?? [], dateLabels30),
    exportsLast30Days: bucketByDay(exports30Res.data ?? [], dateLabels30),
    newUsersLast30Days: bucketByDay(profiles30Res.data ?? [], dateLabels30),
  };
}
