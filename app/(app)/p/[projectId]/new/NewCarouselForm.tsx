"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { generateCarousel } from "@/app/actions/carousels/generateCarousel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BackgroundImagesPickerModal } from "@/components/carousels/BackgroundImagesPickerModal";
import { ArrowLeftIcon, ImageIcon, Loader2Icon, SparklesIcon } from "lucide-react";

const INPUT_TYPES = [
  { value: "topic", label: "Topic" },
  { value: "url", label: "URL" },
  { value: "text", label: "Paste text" },
] as const;

export function NewCarouselForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [inputType, setInputType] = useState<"topic" | "url" | "text">("topic");
  const [inputValue, setInputValue] = useState("");
  const [numberOfSlides, setNumberOfSlides] = useState<string>("");
  const [backgroundAssetIds, setBackgroundAssetIds] = useState<string[]>([]);
  const [useAiBackgrounds, setUseAiBackgrounds] = useState(false);
  const [notes, setNotes] = useState("");
  const [backgroundPickerOpen, setBackgroundPickerOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsPending(true);
    const formData = new FormData();
    formData.set("project_id", projectId);
    formData.set("input_type", inputType);
    formData.set("input_value", inputValue.trim());
    const numSlides = numberOfSlides.trim() ? parseInt(numberOfSlides, 10) : NaN;
    if (!isNaN(numSlides) && numSlides >= 1 && numSlides <= 30) {
      formData.set("number_of_slides", String(numSlides));
    }
    if (backgroundAssetIds.length) formData.set("background_asset_ids", JSON.stringify(backgroundAssetIds));
    if (useAiBackgrounds) formData.set("use_ai_backgrounds", "true");
    const result = await generateCarousel(formData);
    setIsPending(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    router.push(`/p/${projectId}/c/${result.carouselId}`);
  }

  return (
    <>
      <div className="mb-4">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href={`/p/${projectId}`}>
            <ArrowLeftIcon className="size-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
            {error}
          </p>
        )}

        <div className="space-y-2">
          <Label htmlFor="number_of_slides">Number of slides (optional)</Label>
          <Input
            id="number_of_slides"
            type="number"
            min={1}
            max={30}
            placeholder="AI decides if empty"
            value={numberOfSlides}
            onChange={(e) => setNumberOfSlides(e.target.value)}
            className="w-full"
          />
          <p className="text-muted-foreground text-xs">Leave empty for AI to choose (e.g. top 20 → 6 slides with ~4 items each).</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Anything we should know before generating? (optional)</Label>
          <Textarea
            id="notes"
            placeholder="e.g. Focus on beginners, avoid jargon, emphasize X, skip Y..."
            className="min-h-20"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Input type</Label>
          <Select
            value={inputType}
            onValueChange={(v) => setInputType(v as "topic" | "url" | "text")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {INPUT_TYPES.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="input_value">
            {inputType === "text"
              ? "Paste your text"
              : inputType === "url"
                ? "URL"
                : "Topic"}
          </Label>
          {inputType === "text" ? (
            <Textarea
              id="input_value"
              placeholder="Paste or type your content..."
              className="min-h-32"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              required
            />
          ) : (
            <Input
              id="input_value"
              type={inputType === "url" ? "url" : "text"}
              placeholder={
                inputType === "url"
                  ? "https://..."
                  : "e.g. 5 habits of successful creators"
              }
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              required
            />
          )}
        </div>

        <div className="rounded-xl border border-border/80 bg-muted/10 p-4 space-y-4">
          <div>
            <Label className="text-sm font-medium">Background images (optional)</Label>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Pick from your library (round-robin) or let AI suggest images from Unsplash.
            </p>
          </div>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg py-2 text-sm hover:bg-muted/50">
            <input
              type="checkbox"
              checked={useAiBackgrounds}
              onChange={(e) => setUseAiBackgrounds(e.target.checked)}
              className="rounded border-input accent-primary"
            />
            <SparklesIcon className="size-4 text-muted-foreground" />
            <span>Let AI suggest background images (Unsplash)</span>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setBackgroundPickerOpen(true)}
            >
              <ImageIcon className="mr-1.5 size-4" />
              {backgroundAssetIds.length ? `${backgroundAssetIds.length} image(s) selected` : "Pick from library"}
            </Button>
            {backgroundAssetIds.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setBackgroundAssetIds([])}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
        <BackgroundImagesPickerModal
          open={backgroundPickerOpen}
          onOpenChange={setBackgroundPickerOpen}
          selectedIds={backgroundAssetIds}
          onConfirm={setBackgroundAssetIds}
          projectId={projectId}
        />

        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2Icon className="mr-2 size-4 animate-spin" />
              Generating slides…
            </>
          ) : (
            "Generate slides"
          )}
        </Button>
      </form>
    </>
  );
}
