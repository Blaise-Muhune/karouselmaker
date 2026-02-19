"use client";

import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import Link from "next/link";
import { createProject } from "@/app/actions/projects/createProject";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { ArrowLeftIcon, Loader2Icon } from "lucide-react";

const TONE_OPTIONS = [
  { value: "neutral", label: "Neutral" },
  { value: "funny", label: "Funny" },
  { value: "serious", label: "Serious" },
  { value: "savage", label: "Savage" },
  { value: "inspirational", label: "Inspirational" },
] as const;

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
  { value: "it", label: "Italian" },
  { value: "nl", label: "Dutch" },
  { value: "pl", label: "Polish" },
  { value: "ar", label: "Arabic" },
  { value: "hi", label: "Hindi" },
  { value: "zh", label: "Chinese" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
] as const;

export default function NewProjectPage() {
  const [isPending, startTransition] = useTransition();
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const form = useForm<ProjectFormInput>({
    resolver: zodResolver(projectFormSchema) as Resolver<ProjectFormInput>,
    defaultValues: {
      name: "",
      niche: "",
      tone_preset: "neutral",
      language: "en",
      slide_structure: { number_of_slides: 8 },
      voice_rules: { do_rules: "", dont_rules: "" },
      brand_kit: {
        primary_color: "",
        secondary_color: "",
        watermark_text: "",
      },
    },
  });

  function onSubmit(data: ProjectFormInput) {
    const fd = new FormData();
    fd.set("name", data.name);
    fd.set("niche", data.niche ?? "");
    fd.set("tone_preset", data.tone_preset);
    fd.set("language", data.language ?? "en");
    fd.set("number_of_slides", "8"); // Default; set per carousel on New Carousel page
    fd.set("do_rules", data.voice_rules.do_rules ?? "");
    fd.set("dont_rules", data.voice_rules.dont_rules ?? "");
    fd.set("primary_color", data.brand_kit.primary_color ?? "");
    fd.set("secondary_color", data.brand_kit.secondary_color ?? "");
    fd.set("watermark_text", data.brand_kit.watermark_text ?? "");
    if (logoFile && logoFile instanceof File && logoFile.size > 0) {
      fd.set("logo", logoFile);
    }
    startTransition(async () => {
      try {
        await createProject(fd);
      } catch (err) {
        // Next.js redirect() throws; don't treat as form error
        if (err && typeof err === "object" && "digest" in err && (err as { digest?: string }).digest === "NEXT_REDIRECT") return;
        console.error(err);
        form.setError("root", { type: "server", message: "Failed to create project. Try again." });
      }
    });
  }

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
          <h1 className="text-xl font-semibold tracking-tight">New project</h1>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
              name="language"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Language</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {LANGUAGE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-muted-foreground text-xs">All carousels in this project will be generated in this language.</p>
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
            <div className="space-y-2">
              <Label>Voice rules (optional)</Label>
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
              <Label>Brand kit (optional)</Label>
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
                          onLogoUpload={async (file) => {
                            setLogoFile(file);
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
                            setLogoFile(file);
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
            {form.formState.errors.root && (
              <p className="text-destructive text-sm">{form.formState.errors.root.message}</p>
            )}
            <div className="flex gap-4">
              <Button type="submit" disabled={isPending} loading={isPending}>
                {isPending ? "Creating…" : "Create project"}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/projects">Cancel</Link>
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
