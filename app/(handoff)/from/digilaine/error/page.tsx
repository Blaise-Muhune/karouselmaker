import Link from "next/link";
import { Button } from "@/components/ui/button";

const COPY: Record<string, { title: string; body: string }> = {
  config: {
    title: "Connection is not configured",
    body: "This Digilaine link is not set up on Karousel Maker yet. Copy the idea from Promo studio, or try again later.",
  },
  invalid: {
    title: "This link is invalid",
    body: "Go back to Digilaine Promo studio and choose Make this post in Karousel Maker again.",
  },
  expired: {
    title: "This idea expired",
    body: "Handoff links last 20 minutes. Open Karousel Maker from Digilaine Promo studio again.",
  },
};

export default async function DigilaineHandoffErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string | string[] }>;
}) {
  const sp = await searchParams;
  const reason = typeof sp.reason === "string" ? sp.reason : "invalid";
  const copy = COPY[reason] ?? COPY.invalid!;

  return (
    <div className="space-y-4 text-center">
      <h1 className="text-xl font-semibold tracking-tight">{copy.title}</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">{copy.body}</p>
      <Button asChild>
        <Link href="/signup">Go to Karousel Maker</Link>
      </Button>
    </div>
  );
}
