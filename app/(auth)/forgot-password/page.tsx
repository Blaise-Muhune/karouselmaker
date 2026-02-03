"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset } from "@/app/actions/auth";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export default function ForgotPasswordPage() {
  const [state, formAction] = useActionState(
    async (_: unknown, formData: FormData) => {
      return requestPasswordReset(formData);
    },
    null
  );

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">Reset password</h1>
        <p className="text-muted-foreground text-sm">
          Enter your email and we&apos;ll send you a link to reset your password.
        </p>
      </div>
      <Form {...form}>
        <form action={formAction} className="space-y-4">
          {state?.error && (
            <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
              {state.error}
            </p>
          )}
          {state?.success && (
            <p className="bg-green-500/10 text-green-700 dark:text-green-400 rounded-md px-3 py-2 text-sm">
              Check your email for a reset link. It may take a few minutes to arrive.
            </p>
          )}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="you@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full">
            Send reset link
          </Button>
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
