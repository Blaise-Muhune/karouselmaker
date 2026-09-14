import { NextResponse } from "next/server";
import { cleanExpiredExportFiles } from "@/lib/server/storage/exportRetention";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Daily bounded cleanup for temporary rendered exports. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await cleanExpiredExportFiles(100);
  return NextResponse.json(result);
}
