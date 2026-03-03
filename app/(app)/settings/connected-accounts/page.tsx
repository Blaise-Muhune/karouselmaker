import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/server/auth/getUser";
import { isAdmin } from "@/lib/server/auth/isAdmin";
import { getPlatformConnections } from "@/lib/server/db/platformConnections";
import { getSupportedPlatforms } from "@/lib/oauth/platforms";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon, CheckCircleIcon, LinkIcon } from "lucide-react";
import type { PlatformName } from "@/lib/server/db/types";
import { DisconnectPlatformButton } from "./DisconnectPlatformButton";

const LABELS: Record<PlatformName, string> = {
  facebook: "Facebook",
  tiktok: "TikTok",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  youtube: "YouTube",
};

export default async function ConnectedAccountsPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ connected?: string; error?: string }> }>) {
  const { user } = await getUser();
  if (!isAdmin(user.email ?? null)) {
    redirect("/projects?error=admin_only");
  }
  const [connections, supported] = await Promise.all([
    getPlatformConnections(user.id),
    Promise.resolve(getSupportedPlatforms()),
  ]);

  const connectionMap = new Map(connections.map((c) => [c.platform, c]));
  const params = await searchParams;
  const justConnected = params.connected;
  const error = params.error;

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href="/projects">
              <ArrowLeftIcon className="size-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <h1 className="text-xl font-semibold tracking-tight">Connected accounts</h1>
        </div>

        <p className="text-muted-foreground text-sm">
          Connect your social accounts to post carousels and videos from the app. Each platform uses OAuth; we store only the tokens needed to publish.
        </p>

        {justConnected && (
          <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm text-green-700 dark:text-green-400">
            <CheckCircleIcon className="mr-2 inline-block size-4" />
            {LABELS[justConnected as PlatformName] ?? justConnected} connected successfully.
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error === "not_configured" && "This platform is not configured. Add the required env vars (see .env.example)."}
            {error === "invalid_state" && "Invalid or expired link. Try connecting again."}
            {error === "session" && "Your session expired. Log in and try again."}
            {error === "exchange_failed" && "Could not get access token. Try again or check app credentials."}
            {error === "missing_code" && "Missing authorization code. Try connecting again."}
            {!["not_configured", "invalid_state", "session", "exchange_failed", "missing_code"].includes(error) && `Error: ${error}`}
          </div>
        )}

        <div className="space-y-3">
          {(["facebook", "tiktok", "instagram", "linkedin", "youtube"] as PlatformName[]).map((platform) => {
            const conn = connectionMap.get(platform);
            const isSupported = supported.includes(platform);
            return (
              <div
                key={platform}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4"
              >
                <div>
                  <p className="font-medium">{LABELS[platform]}</p>
                  {platform === "youtube" && <p className="text-muted-foreground text-xs">Video only</p>}
                </div>
                <div className="flex items-center gap-2">
                  {conn ? (
                    <>
                      <span className="text-muted-foreground text-sm">
                        {conn.platform_username ? `@${conn.platform_username}` : "Connected"}
                      </span>
                      <DisconnectPlatformButton platform={platform} />
                    </>
                  ) : isSupported ? (
                    <Button size="sm" asChild>
                      <Link href={`/api/oauth/${platform}/connect`}>
                        <LinkIcon className="mr-2 size-4" />
                        Connect
                      </Link>
                    </Button>
                  ) : (
                    <span className="text-muted-foreground text-sm">Add env vars to enable</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-muted-foreground text-xs">
          Configure FACEBOOK_APP_ID, TIKTOK_CLIENT_KEY, LINKEDIN_CLIENT_ID, and/or GOOGLE_CLIENT_ID in your .env (see .env.example). In each provider dashboard, add redirect URI:{" "}
          <code className="rounded bg-muted px-1">{process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://yourapp.com"}/api/oauth/PLATFORM/callback</code> (replace PLATFORM with facebook, tiktok, linkedin, or youtube).
        </p>
      </div>
    </div>
  );
}
