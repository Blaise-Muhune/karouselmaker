"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTemplateAction } from "@/app/actions/templates/createTemplate";
import type { Template } from "@/lib/server/db/types";
import { PlusIcon } from "lucide-react";

type CreateTemplateDialogProps = {
  systemTemplates: Template[];
  isPro: boolean;
  atLimit: boolean;
  children?: React.ReactNode;
};

export function CreateTemplateDialog({
  systemTemplates,
  isPro,
  atLimit,
  children,
}: CreateTemplateDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [baseId, setBaseId] = useState(systemTemplates[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCreate = isPro && !atLimit;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate) return;
    setError(null);
    setLoading(true);
    const base = systemTemplates.find((t) => t.id === baseId);
    const result = await createTemplateAction({
      name,
      category: base?.category ?? "generic",
      baseTemplateId: baseId,
    });
    setLoading(false);
    if (result.ok) {
      setOpen(false);
      setName("");
      setBaseId(systemTemplates[0]?.id ?? "");
      if ("templateId" in result) {
        router.push(`/templates/${result.templateId}/edit`);
      } else {
        router.refresh();
      }
    } else {
      setError(result.error ?? "Failed to create template");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? (
          <Button size="sm" disabled={!canCreate} className="gap-1.5">
            <PlusIcon className="size-4" />
            Create template
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create custom template</DialogTitle>
          <DialogDescription>
            Clone a system template and give it a custom name. Your template will appear in the editor when editing slides.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="base">Base template</Label>
            <select
              id="base"
              value={baseId}
              onChange={(e) => setBaseId(e.target.value)}
              className="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {systemTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.category})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Template name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My hook style"
              maxLength={100}
              required
            />
          </div>
          {error && (
            <p className="text-destructive text-sm">{error}</p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
