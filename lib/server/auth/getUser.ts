import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { User, Session } from "@supabase/supabase-js";

export async function getUser(): Promise<{ user: User; session: Session }> {
  const supabase = await createClient();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session) {
    redirect("/login");
  }

  return { user: session.user, session };
}

/** Same as getUser but returns null when not authenticated (no redirect). Use on public pages like /. */
export async function getOptionalUser(): Promise<{
  user: User | null;
  session: Session | null;
}> {
  const supabase = await createClient();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session) {
    return { user: null, session: null };
  }

  return { user: session.user, session };
}
