"use server";

import { createAdminClient } from "@/lib/supabase/admin";

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
    { count: totalUsers },
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
    supabase.from("profiles").select("*", { count: "exact", head: true }),
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

  const freeUsers = (totalUsers ?? 0) - (proUsers ?? 0);

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
