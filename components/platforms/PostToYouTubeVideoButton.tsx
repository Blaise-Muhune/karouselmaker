"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getVideoUploadPath } from "@/app/actions/platforms/getVideoUploadPath";
import { postVideoToYouTube } from "@/app/actions/platforms/postVideoToYouTube";
import { PlatformIcon } from "@/components/platforms/PlatformIcon";
import { createClient } from "@/lib/supabase/client";
import { Loader2Icon } from "lucide-react";

const BUCKET = "carousel-assets";

export function PostToYouTubeVideoButton({
  carouselId,
  videoBlob,
}: {
  carouselId: string;
  videoBlob: Blob | null;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [postUrl, setPostUrl] = useState<string | null>(null);

  async function handlePost() {
    if (!videoBlob) {
      setError("No video. Generate the video first.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const pathRes = await getVideoUploadPath(carouselId, "youtube");
      if (!pathRes.ok) {
        setError(pathRes.error);
        return;
      }
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(pathRes.path, videoBlob, { contentType: "video/mp4", upsert: true });
      if (uploadError) {
        setError("Upload failed. Try again.");
        return;
      }
      const result = await postVideoToYouTube(carouselId, pathRes.path);
      if (result.ok) {
        setSuccess(true);
        setPostUrl(result.video_url);
      } else {
        setError(result.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (success && postUrl) {
    return (
      <a
        href={postUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted hover:border-primary/50 transition-colors"
        title="View video on YouTube"
      >
        <PlatformIcon platform="youtube" className="size-3.5" />
        <span>View post</span>
      </a>
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
        title="Post video to YouTube"
      >
        {loading ? (
          <Loader2Icon className="size-3.5 animate-spin" />
        ) : (
          <PlatformIcon platform="youtube" className="size-3.5" />
        )}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </span>
  );
}
