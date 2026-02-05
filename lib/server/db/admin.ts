"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export type AdminStats = {
  totalUsers: number;
  totalProjects: number;
  totalCarousels: number;
  totalExports: number;
  proUsers: number;
  freeUsers: number;
  carouselsLast7Days: { date: string; count: number }[];
  exportsLast7Days: { date: string; count: number }[];
  newUsersLast7Days: { date: string; count: number }[];
};

export async function getAdminStats(): Promise<AdminStats | null> {
  const supabase = createAdminClient();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const dateLabels: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dateLabels.push(d.toISOString().slice(0, 10));
  }

  const [
    { count: totalUsers },
    { count: totalProjects },
    { count: totalCarousels },
    { count: totalExports },
    { count: proUsers },
    profilesRes,
    carouselsRes,
    exportsRes,
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("projects").select("*", { count: "exact", head: true }),
    supabase.from("carousels").select("*", { count: "exact", head: true }),
    supabase.from("exports").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("plan", "pro"),
    supabase.from("profiles").select("created_at").gte("created_at", sevenDaysAgo.toISOString()),
    supabase.from("carousels").select("created_at").gte("created_at", sevenDaysAgo.toISOString()),
    supabase.from("exports").select("created_at").gte("created_at", sevenDaysAgo.toISOString()).eq("status", "ready"),
  ]);

  const freeUsers = (totalUsers ?? 0) - (proUsers ?? 0);

  const bucketByDay = (rows: { created_at: string }[]) => {
    const buckets: Record<string, number> = {};
    dateLabels.forEach((d) => (buckets[d] = 0));
    rows.forEach((r) => {
      const d = r.created_at.slice(0, 10);
      if (buckets[d] !== undefined) buckets[d]++;
    });
    return dateLabels.map((date) => ({ date, count: buckets[date] ?? 0 }));
  };

  return {
    totalUsers: totalUsers ?? 0,
    totalProjects: totalProjects ?? 0,
    totalCarousels: totalCarousels ?? 0,
    totalExports: totalExports ?? 0,
    proUsers: proUsers ?? 0,
    freeUsers,
    carouselsLast7Days: bucketByDay(carouselsRes.data ?? []),
    exportsLast7Days: bucketByDay(exportsRes.data ?? []),
    newUsersLast7Days: bucketByDay(profilesRes.data ?? []),
  };
}
