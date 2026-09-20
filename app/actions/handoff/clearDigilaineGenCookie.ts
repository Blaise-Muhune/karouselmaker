"use server";

import { cookies } from "next/headers";
import { DIGILAINE_GEN_COOKIE } from "@/lib/handoff/digilaineHandoff";

export async function clearDigilaineGenCookie() {
  const store = await cookies();
  store.delete(DIGILAINE_GEN_COOKIE);
}
