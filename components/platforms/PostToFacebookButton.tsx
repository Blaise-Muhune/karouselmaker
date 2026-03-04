"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { postToFacebook } from "@/app/actions/platforms/postToFacebook";
import { ExternalLinkIcon, Loader2Icon } from "lucide-react";

export function PostToFacebookButton({ carouselId }: { carouselId: string }) {
  const [loading, setLoading] = useState(false);
  const [postUrl, setPostUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePost() {
    setError(null);
    setLoading(true);
    try {
      const res = await postToFacebook(carouselId);
      if (res.ok) {
        setPostUrl(res.post_url);
      } else {
        setError(res.error);
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (postUrl) {
    return (
      <Button size="sm" variant="outline" asChild>
        <a href={postUrl} target="_blank" rel="noopener noreferrer">
          <ExternalLinkIcon className="mr-2 size-4" />
          View on Facebook
        </a>
      </Button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="default"
        disabled={loading}
        onClick={handlePost}
      >
        {loading ? (
          <Loader2Icon className="mr-2 size-4 animate-spin" />
        ) : null}
        Post to Facebook
      </Button>
      {error && (
        <span className="text-muted-foreground text-xs text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}
