import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

/** Uses auth.getUser() so the server verifies the user with Supabase (recommended over getSession). */
export async function getUser(): Promise<{ user: User }> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return { user };
}

/** Same as getUser but returns null when not authenticated (no redirect). Use on public pages like /. */
export async function getOptionalUser(): Promise<{ user: User | null }> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { user: null };
  }

  return { user };
}
