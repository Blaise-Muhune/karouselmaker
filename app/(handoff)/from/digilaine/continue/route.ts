import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getOptionalUser } from "@/lib/server/auth/getUser";
import {
  DIGILAINE_GEN_COOKIE,
  DIGILAINE_HANDOFF_COOKIE,
  parseDigilaineHandoffCookie,
} from "@/lib/handoff/digilaineHandoff";
import { handoffCookieOptions } from "@/lib/handoff/cookieOptions";
import { findOrCreateProjectFromDigilaineHandoff } from "@/lib/handoff/findOrCreateProject";

export async function GET(request: Request) {
  const { user } = await getOptionalUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login?next=/from/digilaine/continue", request.url));
  }

  const store = await cookies();
  const payload = parseDigilaineHandoffCookie(store.get(DIGILAINE_HANDOFF_COOKIE)?.value);
  if (!payload) {
    return NextResponse.redirect(new URL("/from/digilaine/error?reason=expired", request.url));
  }

  const project = await findOrCreateProjectFromDigilaineHandoff(user.id, payload);
  const response = NextResponse.redirect(new URL(`/p/${project.id}/new`, request.url));
  response.cookies.set(
    DIGILAINE_GEN_COOKIE,
    JSON.stringify({
      topic: payload.topic,
      is_marketing: payload.is_marketing,
      angle: payload.angle,
    }),
    handoffCookieOptions(20 * 60),
  );
  response.cookies.set(DIGILAINE_HANDOFF_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
