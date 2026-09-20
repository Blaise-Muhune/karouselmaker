"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { startCarouselGeneration } from "@/app/actions/carousels/generateCarousel";
import { consumeProjectTopicSuggestion, ensureProjectTopicLineup } from "@/app/actions/carousels/projectTopicSuggestions";
import { Button } from "@/components/ui/button";
import { UpgradePlansDialog } from "@/components/subscription/UpgradePlansDialog";
import { PlusCircleIcon, SparklesIcon } from "lucide-react";

/**
 * One-click generate from project hub using the next queued topic + silent defaults.
 */
export function GenerateNextPostButton({
  projectId,
  nextTopic,
  includeMarketing,
  hasFullAccess,
  isPro,
  carouselCount,
  carouselLimit,
  defaultTemplateId,
}: {
  projectId: string;
  nextTopic: string | null;
  includeMarketing: boolean;
  hasFullAccess: boolean;
  isPro: boolean;
  carouselCount: number;
  carouselLimit: number;
  defaultTemplateId: string | null;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plansOpen, setPlansOpen] = useState(false);

  const topic = nextTopic?.trim() || "";

  async function handleGenerate() {
    setError(null);
    if (!topic) {
      router.push(`/p/${projectId}/new`);
      return;
    }
    setIsPending(true);
    try {
      const formData = new FormData();
      formData.set("project_id", projectId);
      formData.set("input_type", "topic");
      formData.set("input_value", topic);
      formData.set("carousel_for", "instagram");
      formData.set("generation_speed", "fast");
      formData.set("use_ai_backgrounds", "true");
      formData.set("use_stock_photos", "true");
      formData.set("images_related_to_topic", "true");
      formData.set("include_marketing", includeMarketing ? "true" : "false");
      if (defaultTemplateId) formData.set("template_id", defaultTemplateId);

      const result = await startCarouselGeneration(formData);
      if ("error" in result && !("carouselId" in result)) {
        setError(result.error);
        setPlansOpen(true);
        return;
      }

      const consumed = await consumeProjectTopicSuggestion(projectId, topic);
      if ("topics" in consumed && consumed.topics.length === 0) {
        void ensureProjectTopicLineup(projectId, "instagram");
      }

      const carouselId = "carouselId" in result ? result.carouselId : undefined;
      if (carouselId) router.push(`/p/${projectId}/c/${carouselId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <div className="space-y-3 rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Next post</p>
          <p className="text-sm font-medium text-foreground leading-snug">
            {topic || "No topic ready yet — open New post to write one."}
          </p>
          {topic ? (
            <p className="text-muted-foreground text-xs">
              {includeMarketing ? "Will soft-mention your product" : "Value tip (no product pitch)"}
            </p>
          ) : null}
        </div>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="lg"
            className="gap-2"
            disabled={isPending}
            loading={isPending}
            onClick={() => void handleGenerate()}
          >
            <SparklesIcon className="size-4" />
            {topic ? "Generate next" : "New post"}
          </Button>
          <Button type="button" variant="outline" size="lg" className="gap-2" asChild>
            <Link href={`/p/${projectId}/new`}>
              <PlusCircleIcon className="size-4" />
              Customize
            </Link>
          </Button>
        </div>
      </div>
      <UpgradePlansDialog open={plansOpen} onOpenChange={setPlansOpen} />
    </>
  );
}
