"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

type FormSubmitButtonProps = React.ComponentProps<typeof Button> & {
  loadingText?: string;
};

/** Button that shows loading state while its parent form is submitting. */
export function FormSubmitButton({
  children,
  loadingText,
  disabled,
  ...props
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={disabled || pending} loading={pending} {...props}>
      {pending && loadingText ? loadingText : children}
    </Button>
  );
}
