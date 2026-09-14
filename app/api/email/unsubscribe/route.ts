import { setWeeklyCreatorNotePreference } from "@/lib/server/db/emailSubscriptions";
import { isValidUnsubscribeToken } from "@/lib/server/email/preferences";

function requestDetails(request: Request) {
  const url = new URL(request.url);
  return { email: url.searchParams.get("email")?.trim().toLowerCase() || "", token: url.searchParams.get("token") };
}

function validRequest(request: Request) {
  const { email, token } = requestDetails(request);
  return Boolean(email && isValidUnsubscribeToken(email, token));
}

export async function GET(request: Request) {
  if (!validRequest(request)) return new Response("Invalid unsubscribe link.", { status: 400 });
  const { email, token } = requestDetails(request);
  const action = `/api/email/unsubscribe?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token ?? "")}`;
  return new Response(
    `<!doctype html><title>Unsubscribe</title><main style="font-family:Arial,sans-serif;max-width:520px;margin:64px auto;padding:24px"><h1>Stop weekly creator notes?</h1><p>You will still receive account, security, payment, and support emails.</p><form method="post" action="${action}"><button type="submit">Unsubscribe</button></form></main>`,
    { headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

export async function POST(request: Request) {
  if (!validRequest(request)) return new Response("", { status: 400 });
  const { email } = requestDetails(request);
  await setWeeklyCreatorNotePreference(email, false);
  return new Response("", { status: 200 });
}
