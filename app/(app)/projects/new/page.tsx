"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import Link from "next/link";
import { createProject } from "@/app/actions/projects/createProject";
import { Button } from "@/components/ui/button";
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
import { ArrowLeftIcon } from "lucide-react";

const TONE_OPTIONS = [
  { value: "neutral", label: "Neutral" },
  { value: "funny", label: "Funny" },
  { value: "serious", label: "Serious" },
  { value: "savage", label: "Savage" },
  { value: "inspirational", label: "Inspirational" },
] as const;

export default function NewProjectPage() {
  const [isPending, startTransition] = useTransition();

  const form = useForm<ProjectFormInput>({
    resolver: zodResolver(projectFormSchema) as Resolver<ProjectFormInput>,
    defaultValues: {
      name: "",
      niche: "",
      tone_preset: "neutral",
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
    fd.set("number_of_slides", "8"); // Default; set per carousel on New Carousel page
    fd.set("do_rules", data.voice_rules.do_rules ?? "");
    fd.set("dont_rules", data.voice_rules.dont_rules ?? "");
    fd.set("primary_color", data.brand_kit.primary_color ?? "");
    fd.set("secondary_color", data.brand_kit.secondary_color ?? "");
    fd.set("watermark_text", data.brand_kit.watermark_text ?? "");
    startTransition(() => {
      createProject(fd);
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
          <h1 className="text-2xl font-semibold">New project</h1>
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
                      <FormLabel className="text-muted-foreground text-xs">Primary color (hex)</FormLabel>
                      <FormControl>
                        <Input placeholder="#000000" {...field} />
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
                      <FormLabel className="text-muted-foreground text-xs">Secondary color (hex)</FormLabel>
                      <FormControl>
                        <Input placeholder="#666666" {...field} />
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
