"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { postToTiktok } from "@/app/actions/platforms/postToTiktok";
import { PlatformIcon } from "@/components/platforms/PlatformIcon";
import { Loader2Icon } from "lucide-react";

export function PostToTiktokVideoButton({
  carouselId,
  videoBlob,
}: {
  carouselId: string;
  videoBlob: Blob | null;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handlePost() {
    if (!videoBlob) {
      setError("No video. Generate the video first.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.set("video", videoBlob, "video.mp4");
      const result = await postToTiktok(carouselId, formData);
      if (result.ok) {
        setSuccess(true);
      } else {
        setError(result.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2.5 py-1.5 text-xs font-medium text-muted-foreground"
        title="Video sent to your TikTok inbox. Open the app to finish posting."
      >
        <PlatformIcon platform="tiktok" className="size-3.5" />
        <span>Drafted</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={loading || !videoBlob}
        onClick={handlePost}
        className="inline-flex items-center justify-center"
        title="Post video to TikTok"
      >
        {loading ? (
          <Loader2Icon className="size-3.5 animate-spin" />
        ) : (
          <PlatformIcon platform="tiktok" className="size-3.5" />
        )}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </span>
  );
}
