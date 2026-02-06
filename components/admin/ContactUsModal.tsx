"use client";

import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { sendContactMessage } from "@/app/actions/contact";
import { Loader2Icon } from "lucide-react";

type ContactUsModalProps = {
  userEmail: string;
  userName?: string;
};

export function ContactUsModal({ userEmail, userName = "" }: ContactUsModalProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await sendContactMessage(formData);
    setPending(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      setOpen(false);
      setSuccess(false);
    }, 1500);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); setError(null); setSuccess(false); }}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground transition-colors font-inherit bg-transparent border-0 cursor-pointer"
        >
          Contact us
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Contact us</DialogTitle>
          <DialogDescription>
            Send a message and we&apos;ll get back to you.
          </DialogDescription>
        </DialogHeader>
        {success ? (
          <p className="text-sm text-green-600 dark:text-green-400 py-4">Message sent. Thanks!</p>
        ) : (
          <form action={handleSubmit} className="space-y-4">
            {userEmail ? (
              <>
                <input type="hidden" name="senderEmail" value={userEmail} />
                {userName ? <input type="hidden" name="senderName" value={userName} /> : null}
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="senderEmail">Your email (optional)</Label>
                <Input
                  id="senderEmail"
                  name="senderEmail"
                  type="email"
                  placeholder="you@example.com"
                  disabled={pending}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="title">Title (optional)</Label>
              <Input
                id="title"
                name="title"
                placeholder="e.g. Feature request"
                disabled={pending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="body">Message (required)</Label>
              <Textarea
                id="body"
                name="body"
                placeholder="Your message..."
                rows={4}
                required
                disabled={pending}
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending} className="gap-2">
                {pending ? (
                  <>
                    <Loader2Icon className="size-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
