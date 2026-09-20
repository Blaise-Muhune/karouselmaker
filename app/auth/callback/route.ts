import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { welcomeEmail } from "@/lib/server/email/messages";
import { sendTransactionalEmail } from "@/lib/server/email/transactional";
import { safeAuthNext } from "@/lib/auth/safeNext";
import { AUTH_NEXT_COOKIE } from "@/lib/handoff/digilaineHandoff";

function cookieValue(header: string, name: string): string | null {
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const fromCookie = cookieValue(request.headers.get("cookie") ?? "", AUTH_NEXT_COOKIE);
  const next =
    safeAuthNext(searchParams.get("next")) ?? safeAuthNext(fromCookie) ?? "/projects";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      const createdAt = user?.created_at ? Date.parse(user.created_at) : Number.NaN;
      // OAuth callbacks also run on later sign-ins. Restrict this to a new account;
      // Resend's idempotency key protects retries of the first callback.
      if (user?.email && Number.isFinite(createdAt) && Date.now() - createdAt < 15 * 60 * 1000) {
        const message = welcomeEmail();
        const result = await sendTransactionalEmail({
          to: user.email,
          ...message,
          idempotencyKey: `welcome:${user.id}`,
        });
        if (!result.sent) console.error("Welcome email error:", result.reason);
      }
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";

      const target = isLocalEnv
        ? `${origin}${next}`
        : forwardedHost
          ? `https://${forwardedHost}${next}`
          : `${origin}${next}`;
      const response = NextResponse.redirect(target);
      response.cookies.set(AUTH_NEXT_COOKIE, "", { path: "/", maxAge: 0 });
      return response;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback`);
}
