"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Plan } from "./types";

function profilePlanLabel(raw: string | null | undefined): Plan | null {
  if (raw === "free" || raw === "starter" || raw === "pro" || raw === "studio") return raw;
  return null;
}

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
  plan: Plan | null;
  howFoundUs: string | null;
  createdAt: string | null;
  carouselCount: number;
  projectCount: number;
  exportCount: number;
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
  const [profilesRes, carouselsRes, projectsRes, exportsRes] = await Promise.all([
    supabase.from("profiles").select("user_id, display_name, plan, how_found_us").in("user_id", userIds),
    supabase.from("carousels").select("user_id").in("user_id", userIds),
    supabase.from("projects").select("user_id").in("user_id", userIds),
    supabase.from("exports").select("user_id").in("user_id", userIds),
  ]);

  const profiles = profilesRes.data ?? [];
  const profileByUserId = new Map(
    profiles.map((p) => [
      (p as { user_id: string; display_name: string | null; plan: string | null }).user_id,
      p as { display_name: string | null; plan: string | null; how_found_us: string | null },
    ])
  );

  const countByUser = (rows: { user_id: string }[]): Map<string, number> => {
    const m = new Map<string, number>();
    for (const r of rows) {
      m.set(r.user_id, (m.get(r.user_id) ?? 0) + 1);
    }
    return m;
  };
  const carouselByUser = countByUser((carouselsRes.data ?? []) as { user_id: string }[]);
  const projectByUser = countByUser((projectsRes.data ?? []) as { user_id: string }[]);
  const exportByUser = countByUser((exportsRes.data ?? []) as { user_id: string }[]);

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
      plan: profilePlanLabel(profile?.plan),
      howFoundUs: profile?.how_found_us?.trim() || null,
      createdAt: u.created_at,
      carouselCount: carouselByUser.get(u.id) ?? 0,
      projectCount: projectByUser.get(u.id) ?? 0,
      exportCount: exportByUser.get(u.id) ?? 0,
    };
  });
}

export type AdminUserDetailCarousel = {
  id: string;
  title: string;
  input_value: string | null;
  project_id: string;
  projectName: string | null;
  created_at: string;
  status: string;
};

export type AdminUserDetails = {
  user: { id: string; email: string | null; name: string; plan: Plan | null; createdAt: string | null };
  projects: { id: string; name: string }[];
  carousels: AdminUserDetailCarousel[];
};

/** Fetch one user's profile and their projects + carousels (with project name) for admin. */
export async function getAdminUserDetails(userId: string): Promise<AdminUserDetails | null> {
  const supabase = createAdminClient();
  const [authRes, profileRes, projectsRes, carouselsRes] = await Promise.all([
    supabase.auth.admin.getUserById(userId),
    supabase.from("profiles").select("user_id, display_name, plan").eq("user_id", userId).maybeSingle(),
    supabase.from("projects").select("id, name").eq("user_id", userId).order("name"),
    supabase.from("carousels").select("id, title, input_value, project_id, created_at, status").eq("user_id", userId).order("created_at", { ascending: false }),
  ]);

  const userData = authRes.data?.user;
  if (authRes.error && authRes.error.message?.toLowerCase().includes("not found")) return null;
  const profile = profileRes.data as { user_id: string; display_name: string | null; plan: string | null } | null;
  const projects = (projectsRes.data ?? []) as { id: string; name: string }[];
  const carouselsRaw = (carouselsRes.data ?? []) as { id: string; title: string; input_value: string | null; project_id: string; created_at: string; status: string }[];

  const projectById = new Map(projects.map((p) => [p.id, p.name]));
  const carousels: AdminUserDetailCarousel[] = carouselsRaw.map((c) => ({
    id: c.id,
    title: c.title,
    input_value: c.input_value ?? null,
    project_id: c.project_id,
    projectName: projectById.get(c.project_id) ?? null,
    created_at: c.created_at,
    status: c.status,
  }));

  const meta = (userData?.user_metadata ?? {}) as Record<string, unknown>;
  const name =
    (profile?.display_name?.trim()) ||
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta.name === "string" && meta.name.trim()) ||
    "—";

  return {
    user: {
      id: userId,
      email: userData?.email ?? null,
      name,
      plan: profilePlanLabel(profile?.plan),
      createdAt: userData?.created_at ?? null,
    },
    projects,
    carousels,
  };
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
