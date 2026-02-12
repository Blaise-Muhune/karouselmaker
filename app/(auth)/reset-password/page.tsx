"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useActionState } from "react";
import { updatePassword } from "@/app/actions/auth";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validations/auth";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);

  const [state, formAction] = useActionState(
    async (_: unknown, formData: FormData) => {
      return updatePassword(formData);
    },
    null
  );

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  useEffect(() => {
    const supabase = createClient();
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const hasRecoveryHash = hash && new URLSearchParams(hash.replace(/^#/, "")).get("type") === "recovery";

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setReady(true);
    });

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setReady(true);
        return;
      }
      if (hasRecoveryHash) {
        await new Promise((r) => setTimeout(r, 800));
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          setReady(true);
          return;
        }
      }
      setInvalidLink(true);
    };

    checkSession();
    return () => subscription.unsubscribe();
  }, []);

  if (!ready && !invalidLink) {
    return (
      <div className="space-y-6 text-center">
        <h1 className="text-2xl font-semibold">Reset password</h1>
        <p className="text-muted-foreground text-sm">Verifying your link...</p>
      </div>
    );
  }

  if (invalidLink) {
    return (
      <div className="space-y-6 text-center">
        <h1 className="text-2xl font-semibold">Invalid or expired link</h1>
        <p className="text-muted-foreground text-sm">
          This reset link is invalid or has expired. Please request a new one.
        </p>
        <Button asChild className="w-full">
          <Link href="/forgot-password">Request new link</Link>
        </Button>
        <p className="text-center text-muted-foreground text-sm">
          <Link href="/login" className="text-primary underline-offset-4 hover:underline">
            Back to log in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">Set new password</h1>
        <p className="text-muted-foreground text-sm">
          Enter your new password below.
        </p>
      </div>
      <Form {...form}>
        <form action={formAction} className="space-y-4">
          {state?.error && (
            <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
              {state.error}
            </p>
          )}
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New password</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="••••••••" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm password</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="••••••••" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormSubmitButton className="w-full" loadingText="Updating…">
            Update password
          </FormSubmitButton>
        </form>
      </Form>
      <p className="text-center text-muted-foreground text-sm">
        <Link href="/login" className="text-primary underline-offset-4 hover:underline">
          Back to log in
        </Link>
      </p>
    </div>
  );
}
