import { cookies } from "next/headers";
import { AUTH_NEXT_COOKIE, DIGILAINE_GEN_COOKIE } from "@/lib/handoff/digilaineHandoff";
import { handoffCookieOptions } from "@/lib/handoff/cookieOptions";

export async function readDigilaineGenCookie(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(DIGILAINE_GEN_COOKIE)?.value;
}

export async function setAuthNextCookie(next: string) {
  const store = await cookies();
  store.set(AUTH_NEXT_COOKIE, next, handoffCookieOptions(600));
}
