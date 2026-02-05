"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteTemplateAction } from "@/app/actions/templates/deleteTemplate";
import { Trash2Icon } from "lucide-react";

type DeleteTemplateButtonProps = {
  templateId: string;
  templateName: string;
  isPro: boolean;
};

export function DeleteTemplateButton({
  templateId,
  templateName,
  isPro,
}: DeleteTemplateButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isPro) return null;

  const handleDelete = async () => {
    setLoading(true);
    const result = await deleteTemplateAction(templateId);
    setLoading(false);
    if (result.ok) {
      setOpen(false);
      router.refresh();
    } else {
      alert(result.error ?? "Failed to delete template");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:text-destructive"
          aria-label={`Delete ${templateName}`}
        >
          <Trash2Icon className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete template</DialogTitle>
          <DialogDescription>
            Delete &quot;{templateName}&quot;? Slides using this template will fall back to the default. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
