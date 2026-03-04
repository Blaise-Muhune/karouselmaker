"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { postToInstagram } from "@/app/actions/platforms/postToInstagram";
import { ExternalLinkIcon, Loader2Icon } from "lucide-react";

export function PostToInstagramButton({ carouselId }: { carouselId: string }) {
  const [loading, setLoading] = useState(false);
  const [postUrl, setPostUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePost() {
    setError(null);
    setLoading(true);
    try {
      const res = await postToInstagram(carouselId);
      if (res.ok && res.permalink) {
        setPostUrl(res.permalink);
      } else if (res.ok) {
        setPostUrl("https://www.instagram.com/");
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
          View on Instagram
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
        Post to Instagram
      </Button>
      {error && (
        <span className="text-xs text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}
