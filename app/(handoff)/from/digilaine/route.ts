import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getOptionalUser } from "@/lib/server/auth/getUser";
import {
  DIGILAINE_HANDOFF_COOKIE,
  getDigilaineHandoffSecret,
  parseDigilaineHandoffCookie,
  verifyDigilaineKarouselHandoff,
} from "@/lib/handoff/digilaineHandoff";
import { handoffCookieOptions } from "@/lib/handoff/cookieOptions";

function redirectTo(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, request.url));
}

export async function GET(request: Request) {
  const secret = getDigilaineHandoffSecret();
  if (!secret) {
    return redirectTo(request, "/from/digilaine/error?reason=config");
  }

  const token = new URL(request.url).searchParams.get("h");
  const verified = verifyDigilaineKarouselHandoff(token, secret);
  if (!verified.ok) {
    const store = await cookies();
    const existing = parseDigilaineHandoffCookie(store.get(DIGILAINE_HANDOFF_COOKIE)?.value);
    if (!existing) {
      return redirectTo(request, "/from/digilaine/error?reason=invalid");
    }
    const { user } = await getOptionalUser();
    return redirectTo(request, user ? "/from/digilaine/continue" : "/signup?next=/from/digilaine/continue");
  }

  const { user } = await getOptionalUser();
  const destination = user ? "/from/digilaine/continue" : "/signup?next=/from/digilaine/continue";
  const response = redirectTo(request, destination);
  response.cookies.set(
    DIGILAINE_HANDOFF_COOKIE,
    JSON.stringify(verified.payload),
    handoffCookieOptions(20 * 60),
  );
  return response;
}
