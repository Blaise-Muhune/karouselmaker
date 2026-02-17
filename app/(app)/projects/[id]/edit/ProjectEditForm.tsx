"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { updateProject } from "@/app/actions/projects/updateProject";
import { uploadProjectLogo } from "@/app/actions/projects/uploadProjectLogo";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  projectFormSchema,
  type ProjectFormInput,
} from "@/lib/validations/project";
import { DO_PRESETS, DONT_PRESETS } from "@/lib/editor/voicePresets";
import { ArrowLeftIcon } from "lucide-react";

const TONE_OPTIONS = [
  { value: "neutral", label: "Neutral" },
  { value: "funny", label: "Funny" },
  { value: "serious", label: "Serious" },
  { value: "savage", label: "Savage" },
  { value: "inspirational", label: "Inspirational" },
] as const;

export function ProjectEditForm({
  projectId,
  defaultValues,
}: {
  projectId: string;
  defaultValues: ProjectFormInput;
}) {
  const [isPending, setIsPending] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const router = useRouter();

  const form = useForm<ProjectFormInput>({
    resolver: zodResolver(projectFormSchema) as Resolver<ProjectFormInput>,
    defaultValues,
  });

  async function onSubmit(data: ProjectFormInput) {
    setSubmitError(null);
    setIsPending(true);
    const fd = new FormData();
    fd.set("name", data.name);
    fd.set("niche", data.niche ?? "");
    fd.set("tone_preset", data.tone_preset);
    fd.set("number_of_slides", "8"); // Default; set per carousel on New Carousel page
    fd.set("do_rules", data.voice_rules.do_rules ?? "");
    fd.set("dont_rules", data.voice_rules.dont_rules ?? "");
    fd.set("primary_color", data.brand_kit.primary_color ?? "");
    fd.set("secondary_color", data.brand_kit.secondary_color ?? "");
    fd.set("watermark_text", data.brand_kit.watermark_text ?? "");
    fd.set("logo_storage_path", data.brand_kit.logo_storage_path ?? "");
    try {
      const result = await updateProject(projectId, fd);
      if (result && "error" in result) {
        const err = result.error;
        setSubmitError(
          typeof err === "string"
            ? err
            : typeof err === "object" && err !== null
              ? Object.values(err)
                  .flat()
                  .filter(Boolean)
                  .join(". ") || "Please fix the errors below."
              : "Save failed."
        );
      }
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {submitError && (
          <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm" role="alert">
            {submitError}
          </p>
        )}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="My Carousel Project" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="niche"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Niche (optional)</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Marketing, Fitness" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="tone_preset"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tone</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
                value={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select tone" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {TONE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <p className="text-muted-foreground text-xs">Default number of slides per carousel is set when you create a new carousel.</p>
        <div className="space-y-2">
          <FormLabel>Voice rules (optional)</FormLabel>
          <p className="text-muted-foreground text-xs">
            Click a preset to add it. You can also type your own.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="voice_rules.do_rules"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground text-xs">Do</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Do: use short sentences..."
                      className="min-h-20"
                      {...field}
                    />
                  </FormControl>
                  <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-md border border-dashed border-border/60 bg-muted/30 p-2">
                    {DO_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          const current = field.value ?? "";
                          const sep = current.trim() ? "\n" : "";
                          field.onChange(current + sep + preset);
                        }}
                        className="rounded-md border border-border/60 bg-background px-2 py-1 text-muted-foreground text-xs hover:bg-muted hover:text-foreground transition-colors"
                      >
                        + {preset}
                      </button>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="voice_rules.dont_rules"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground text-xs">Don&apos;t</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Don't: use jargon..."
                      className="min-h-20"
                      {...field}
                    />
                  </FormControl>
                  <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-md border border-dashed border-border/60 bg-muted/30 p-2">
                    {DONT_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          const current = field.value ?? "";
                          const sep = current.trim() ? "\n" : "";
                          field.onChange(current + sep + preset);
                        }}
                        className="rounded-md border border-border/60 bg-background px-2 py-1 text-muted-foreground text-xs hover:bg-muted hover:text-foreground transition-colors"
                      >
                        + {preset}
                      </button>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
        <div className="space-y-2">
          <FormLabel>Brand kit (optional)</FormLabel>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="brand_kit.primary_color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground text-xs">Primary color</FormLabel>
                  <FormControl>
                    <ColorPicker
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      placeholder="#000000"
                      onExtractFromLogo={(primary, secondary) => {
                        form.setValue("brand_kit.primary_color", primary);
                        form.setValue("brand_kit.secondary_color", secondary);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="brand_kit.secondary_color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground text-xs">Secondary color</FormLabel>
                  <FormControl>
                        <ColorPicker
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          placeholder="#666666"
                          onExtractFromLogo={(primary, secondary) => {
                            form.setValue("brand_kit.primary_color", primary);
                            form.setValue("brand_kit.secondary_color", secondary);
                          }}
                          onLogoUpload={async (file) => {
                            setLogoUploading(true);
                            try {
                              const fd = new FormData();
                              fd.set("logo", file);
                              const result = await uploadProjectLogo(projectId, fd);
                              if (result.ok) {
                                form.setValue("brand_kit.logo_storage_path", result.storagePath);
                                router.refresh();
                                return result.storagePath;
                              }
                            } finally {
                              setLogoUploading(false);
                            }
                            return null;
                          }}
                        />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="brand_kit.watermark_text"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel className="text-muted-foreground text-xs">Watermark text</FormLabel>
                  <FormControl>
                    <Input placeholder="@handle" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
        <div className="flex gap-4">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href={`/p/${projectId}`}>
              <ArrowLeftIcon className="mr-2 size-4" />
              Back to project
            </Link>
          </Button>
        </div>
      </form>
    </Form>
  );
}
