import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Export runs synchronously in POST /api/export/[carouselId].
 * This route is not used; export status is returned directly from that POST.
 */
export async function GET() {
  return NextResponse.json(
    { error: "Use POST /api/export/[carouselId] to create an export." },
    { status: 404 }
  );
}

export async function POST() {
  return NextResponse.json(
    { error: "Use POST /api/export/[carouselId] to create an export." },
    { status: 404 }
  );
}
