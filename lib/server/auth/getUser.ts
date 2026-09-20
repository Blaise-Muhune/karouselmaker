import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";
import { isAuthSessionMissingError } from "@supabase/supabase-js";
import { cache } from "react";
import { safeAuthNext } from "@/lib/auth/safeNext";

async function loginRedirectHref(): Promise<string> {
  try {
    const headerList = await headers();
    const pathname = headerList.get("x-pathname") ?? headerList.get("next-url") ?? "";
    const next = safeAuthNext(pathname);
    if (!next) return "/login";
    return `/login?next=${encodeURIComponent(next)}`;
  } catch {
    return "/login";
  }
}

// React cache is scoped to the render/request, never shared between users.
const getVerifiedUser = cache(async (): Promise<{ user: User | null }> => {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) {
    if (isAuthSessionMissingError(error) || error.status === 401 || error.status === 403 ||
        error.code === "refresh_token_not_found" || error.code === "refresh_token_already_used" ||
        error.code === "session_not_found" || error.code === "session_expired" ||
        error.code === "bad_jwt") {
      return { user: null };
    }
    // Network failures, rate limits and service outages do not mean signed out.
    // Let the error boundary offer a retry without discarding the current URL.
    throw error;
  }
  return { user };
});

/** Uses auth.getUser() so the server verifies the user with Supabase (recommended over getSession). */
export async function getUser(): Promise<{ user: User }> {
  const { user } = await getVerifiedUser();

  if (!user) {
    redirect(await loginRedirectHref());
  }

  return { user };
}

/** Same as getUser but returns null when not authenticated (no redirect). Use on public pages like /. */
export async function getOptionalUser(): Promise<{ user: User | null }> {
  return getVerifiedUser();
}
