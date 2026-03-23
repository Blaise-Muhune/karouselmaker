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
  /** When true, show delete for system templates (admin only). */
  isAdmin?: boolean;
  /** When true, template is system-owned; delete shown only if isAdmin. */
  isSystemTemplate?: boolean;
  /** Called after successful delete (e.g. to refresh list or close modal). */
  onDeleted?: () => void;
};

export function DeleteTemplateButton({
  templateId,
  templateName,
  isPro,
  isAdmin = false,
  isSystemTemplate = false,
  onDeleted,
}: DeleteTemplateButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const canDelete = isPro || (isAdmin && isSystemTemplate);
  if (!canDelete) return null;

  const handleDelete = async () => {
    setLoading(true);
    const result = await deleteTemplateAction(templateId);
    setLoading(false);
    if (result.ok) {
      setOpen(false);
      router.refresh();
      onDeleted?.();
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
            {isSystemTemplate
              ? `Delete "${templateName}" for everyone? Frames using it will fall back to each user's default template. This cannot be undone.`
              : `Delete "${templateName}" from your account? Frames using this template will fall back to your default template. This cannot be undone.`}
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
