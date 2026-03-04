"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getTiktokUploadPath } from "@/app/actions/platforms/getTiktokUploadPath";
import { postToTiktok } from "@/app/actions/platforms/postToTiktok";
import { createClient } from "@/lib/supabase/client";
import { Loader2Icon } from "lucide-react";

const BUCKET = "carousel-assets";

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
      const pathRes = await getTiktokUploadPath(carouselId);
      if (!pathRes.ok) {
        setError(pathRes.error);
        return;
      }
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(pathRes.path, videoBlob, { contentType: "video/mp4", upsert: true });
      if (uploadError) {
        setError("Upload failed. Try again or check storage settings.");
        return;
      }
      const result = await postToTiktok(carouselId, pathRes.path);
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
      <span className="text-xs text-green-600 dark:text-green-400">
        Sent to TikTok inbox. Open the app to post.
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
        className="inline-flex items-center"
      >
        {loading ? <Loader2Icon className="mr-1.5 size-3.5 animate-spin" /> : null}
        Post to TikTok
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </span>
  );
}
