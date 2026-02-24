import { NextResponse } from "next/server";
import { verifyProxySignature } from "@/lib/server/proxyImageUrl";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const sig = searchParams.get("sig");

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
      return NextResponse.json(
        { error: `Upstream returned ${res.status}` },
        { status: res.status === 404 ? 404 : 502 }
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
