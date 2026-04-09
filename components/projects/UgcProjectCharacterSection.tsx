"use client";

import type { Control } from "react-hook-form";
import { CameraIcon, ImageIcon, PenLineIcon } from "lucide-react";
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { UGC_CHARACTER_BRIEF_MAX_CHARS } from "@/lib/constants";
import type { ProjectFormInput } from "@/lib/validations/project";
import { cn } from "@/lib/utils";

const BRIEF_PLACEHOLDER = `Set the scene in plain language: who's on camera, where you usually film, what the light feels like, what they wear on an ordinary day. Example: "Same person every time—warm side light from a window, messy bun, gold hoops, oversized cream sweatshirt at a cluttered desk; evenings they’re under a soft desk lamp with the monitor glow on their face."`;

export function UgcProjectCharacterSection({
  control,
  maxAvatarAssets,
  onOpenAvatarPicker,
}: {
  control: Control<ProjectFormInput>;
  maxAvatarAssets: number;
  onOpenAvatarPicker: () => void;
}) {
  return (
    <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 sm:p-5 space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">Recurring creator</h3>
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          Give the AI a <span className="font-medium text-foreground">written story</span> and/or{" "}
          <span className="font-medium text-foreground">photos</span>—both are first-class inputs. When you{" "}
          <span className="font-medium text-foreground">New carousel</span>, pick{" "}
          <span className="font-medium text-foreground">AI generate</span> and enable{" "}
          <span className="font-medium text-foreground">Same person from project</span>.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-5 lg:items-stretch">
        <div
          className={cn(
            "flex flex-col rounded-lg border border-border/90 bg-background p-4 shadow-sm",
            "ring-1 ring-border/40"
          )}
        >
          <div className="flex items-start gap-3 mb-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <PenLineIcon className="size-4" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold text-foreground">Story &amp; details</p>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Describe them the way you&apos;d brief a friend: face shape and hair, skin tone, build, age vibe, go-to outfit,
                and the rooms or light you keep coming back to. Richer sensory detail helps the model stay on-model when
                there aren&apos;t photos—or reinforces them when there are.
              </p>
            </div>
          </div>
          <FormField
            control={control}
            name="ugc_character_brief"
            render={({ field }) => {
              const len = (field.value ?? "").length;
              return (
                <FormItem className="flex flex-1 flex-col gap-2 space-y-0">
                  <FormControl>
                    <Textarea
                      placeholder={BRIEF_PLACEHOLDER}
                      className="min-h-[220px] flex-1 resize-y text-sm leading-relaxed"
                      maxLength={UGC_CHARACTER_BRIEF_MAX_CHARS}
                      {...field}
                    />
                  </FormControl>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {len}/{UGC_CHARACTER_BRIEF_MAX_CHARS}
                  </p>
                  <FormMessage />
                </FormItem>
              );
            }}
          />
        </div>

        <div
          className={cn(
            "flex flex-col rounded-lg border border-border/90 bg-background p-4 shadow-sm",
            "ring-1 ring-border/40"
          )}
        >
          <div className="flex items-start gap-3 mb-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <CameraIcon className="size-4" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold text-foreground">Face &amp; body references</p>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Up to {maxAvatarAssets} photos of the <span className="font-medium text-foreground">same</span> person from
                your library—mix close-ups, farther shots, and different expressions. We send them with every AI background
                so identity comes from pixels, not guesswork.
              </p>
            </div>
          </div>
          <FormField
            control={control}
            name="ugc_character_avatar_asset_ids"
            render={({ field }) => {
              const n = field.value?.length ?? 0;
              return (
                <FormItem className="flex flex-1 flex-col space-y-0">
                  <div className="flex flex-1 flex-col justify-center rounded-md border border-dashed border-border/80 bg-muted/20 px-4 py-6 min-h-[220px]">
                    <div className="flex flex-col items-center justify-center gap-3 text-center">
                      <div className="flex size-12 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
                        <ImageIcon className="size-6" aria-hidden />
                      </div>
                      <p className="text-[11px] text-muted-foreground max-w-[240px] leading-snug">
                        {n > 0
                          ? `${n} photo${n !== 1 ? "s" : ""} selected — add or swap anytime.`
                          : "No references yet — add photos when you’re ready."}
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          className="h-9"
                          onClick={onOpenAvatarPicker}
                        >
                          <ImageIcon className="mr-2 size-3.5" />
                          {n > 0 ? `Manage photos (${n}/${maxAvatarAssets})` : `Add from library (0/${maxAvatarAssets})`}
                        </Button>
                        {n > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-9 text-muted-foreground"
                            onClick={() => field.onChange([])}
                          >
                            Clear all
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              );
            }}
          />
        </div>
      </div>
    </div>
  );
}
