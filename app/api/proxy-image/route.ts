import { NextResponse } from "next/server";
import { verifyProxySignature } from "@/lib/server/proxyImageUrl";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestUrl = request.url;
  const qIndex = requestUrl.indexOf("?");
  const queryString = qIndex >= 0 ? requestUrl.slice(qIndex + 1) : "";
  // Parse url param robustly: it may be long or contain & (Supabase ?token=...&sig=...).
  // Our proxy URL is ?url=ENCODED&sig=OUR_HMAC, so take everything between "url=" and the last "&sig=" as url.
  let url: string | null = null;
  let sig: string | null = null;
  const urlPrefix = "url=";
  const sigPrefix = "&sig=";
  const urlStart = queryString.indexOf(urlPrefix);
  const sigStart = queryString.lastIndexOf(sigPrefix);
  if (urlStart >= 0 && sigStart > urlStart) {
    const urlEncoded = queryString.slice(urlStart + urlPrefix.length, sigStart);
    sig = queryString.slice(sigStart + sigPrefix.length).split("&")[0] ?? null; // sig is hex, no decode
    try {
      url = decodeURIComponent(urlEncoded.replace(/\+/g, " "));
    } catch {
      url = null;
    }
  }
  if (!url || !sig) {
    const fallback = new URL(requestUrl);
    url = url ?? fallback.searchParams.get("url");
    sig = sig ?? fallback.searchParams.get("sig");
  }
  if (!url || !sig) {
    return NextResponse.json({ error: "Missing url or sig" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }
  if (!/^https?:$/i.test(parsed.protocol)) {
    return NextResponse.json({ error: "Invalid protocol" }, { status: 400 });
  }

  if (!verifyProxySignature(url, sig)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "KarouselMaker-ImageProxy/1" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const status = res.status;
      // Pass through 4xx from upstream (e.g. 403 expired signed URL) so callers can distinguish from proxy failure
      const proxyStatus = status === 404 ? 404 : status >= 400 && status < 500 ? status : 502;
      return NextResponse.json(
        { error: `Upstream returned ${status}` },
        { status: proxyStatus }
      );
    }
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const blob = await res.blob();
    return new NextResponse(blob, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fetch failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
