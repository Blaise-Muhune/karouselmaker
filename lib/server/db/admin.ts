"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { queryMany, queryOne } from "./pg";
import type { Plan } from "./types";

function profilePlanLabel(raw: string | null | undefined): Plan | null {
  if (raw === "free" || raw === "creator" || raw === "growth" || raw === "starter" || raw === "pro" || raw === "studio") return raw;
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

/** List users with name and email for admin. Uses Auth + Azure profiles; capped at 500. */
export async function getAdminUsers(): Promise<AdminUserRow[]> {
  const supabase = createAdminClient();
  const perPage = 1000;
  const maxUsers = 500;
  const rows: {
    id: string;
    email: string | null;
    user_metadata: Record<string, unknown>;
    created_at: string | null;
  }[] = [];
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
  if (userIds.length === 0) return [];

  const [profiles, carousels, projects, exportCounts] = await Promise.all([
    queryMany<{
      user_id: string;
      display_name: string | null;
      plan: string | null;
      how_found_us: string | null;
    }>(
      `select user_id, display_name, plan, how_found_us
       from profiles where user_id = any($1::uuid[])`,
      [userIds]
    ),
    queryMany<{ user_id: string }>(
      `select user_id from carousels where user_id = any($1::uuid[])`,
      [userIds]
    ),
    queryMany<{ user_id: string }>(
      `select user_id from projects where user_id = any($1::uuid[])`,
      [userIds]
    ),
    queryMany<{ user_id: string }>(
      `select c.user_id
       from exports e
       join carousels c on c.id = e.carousel_id
       where c.user_id = any($1::uuid[])`,
      [userIds]
    ),
  ]);

  const profileByUserId = new Map(profiles.map((p) => [p.user_id, p]));

  const countByUser = (list: { user_id: string }[]): Map<string, number> => {
    const m = new Map<string, number>();
    for (const r of list) {
      m.set(r.user_id, (m.get(r.user_id) ?? 0) + 1);
    }
    return m;
  };
  const carouselByUser = countByUser(carousels);
  const projectByUser = countByUser(projects);
  const exportByUser = countByUser(exportCounts);

  return rows.map((u) => {
    const profile = profileByUserId.get(u.id);
    const meta = u.user_metadata ?? {};
    const name =
      profile?.display_name?.trim() ||
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
  user: {
    id: string;
    email: string | null;
    name: string;
    plan: Plan | null;
    createdAt: string | null;
  };
  projects: { id: string; name: string }[];
  carousels: AdminUserDetailCarousel[];
};

export async function getAdminUserDetails(userId: string): Promise<AdminUserDetails | null> {
  const supabase = createAdminClient();
  const [authRes, profile, projects, carouselsRaw] = await Promise.all([
    supabase.auth.admin.getUserById(userId),
    queryOne<{ user_id: string; display_name: string | null; plan: string | null }>(
      `select user_id, display_name, plan from profiles where user_id = $1`,
      [userId]
    ),
    queryMany<{ id: string; name: string }>(
      `select id, name from projects where user_id = $1 order by name`,
      [userId]
    ),
    queryMany<{
      id: string;
      title: string;
      input_value: string | null;
      project_id: string;
      created_at: string;
      status: string;
    }>(
      `select id, title, input_value, project_id, created_at, status
       from carousels where user_id = $1 order by created_at desc`,
      [userId]
    ),
  ]);

  const userData = authRes.data?.user;
  if (authRes.error && authRes.error.message?.toLowerCase().includes("not found")) return null;

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
    profile?.display_name?.trim() ||
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
    const d = String(r.created_at).slice(0, 10);
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
    totalUsers,
    totalProjects,
    totalCarousels,
    totalSlides,
    totalExports,
    proUsers,
    profiles7,
    carousels7,
    exports7,
    profiles30,
    carousels30,
    exports30,
  ] = await Promise.all([
    countAuthUsers(supabase),
    queryOne<{ count: string }>(`select count(*)::text as count from projects`).then(
      (r) => Number(r?.count ?? 0)
    ),
    queryOne<{ count: string }>(`select count(*)::text as count from carousels`).then(
      (r) => Number(r?.count ?? 0)
    ),
    queryOne<{ count: string }>(`select count(*)::text as count from slides`).then(
      (r) => Number(r?.count ?? 0)
    ),
    queryOne<{ count: string }>(`select count(*)::text as count from exports`).then(
      (r) => Number(r?.count ?? 0)
    ),
    queryOne<{ count: string }>(
      `select count(*)::text as count from profiles where plan in ('creator', 'growth', 'starter', 'pro', 'studio')`
    ).then((r) => Number(r?.count ?? 0)),
    queryMany<{ created_at: string }>(
      `select created_at from profiles where created_at >= $1`,
      [sevenDaysAgo.toISOString()]
    ),
    queryMany<{ created_at: string }>(
      `select created_at from carousels where created_at >= $1`,
      [sevenDaysAgo.toISOString()]
    ),
    queryMany<{ created_at: string }>(
      `select created_at from exports where created_at >= $1 and status = 'ready'`,
      [sevenDaysAgo.toISOString()]
    ),
    queryMany<{ created_at: string }>(
      `select created_at from profiles where created_at >= $1`,
      [thirtyDaysAgo.toISOString()]
    ),
    queryMany<{ created_at: string }>(
      `select created_at from carousels where created_at >= $1`,
      [thirtyDaysAgo.toISOString()]
    ),
    queryMany<{ created_at: string }>(
      `select created_at from exports where created_at >= $1 and status = 'ready'`,
      [thirtyDaysAgo.toISOString()]
    ),
  ]);

  return {
    totalUsers: totalUsers ?? 0,
    totalProjects,
    totalCarousels,
    totalSlides,
    totalExports,
    proUsers,
    freeUsers: (totalUsers ?? 0) - proUsers,
    carouselsLast7Days: bucketByDay(carousels7, dateLabels7),
    exportsLast7Days: bucketByDay(exports7, dateLabels7),
    newUsersLast7Days: bucketByDay(profiles7, dateLabels7),
    carouselsLast30Days: bucketByDay(carousels30, dateLabels30),
    exportsLast30Days: bucketByDay(exports30, dateLabels30),
    newUsersLast30Days: bucketByDay(profiles30, dateLabels30),
  };
}
