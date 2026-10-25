import { LoaderCircle } from "lucide-react";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";

type SubmitButtonProps = ComponentProps<typeof Button> & {
  pending: boolean;
  pendingLabel?: string;
};

export function SubmitButton({
  pending,
  pendingLabel = "Aguarde…",
  children,
  disabled,
  ...props
}: SubmitButtonProps) {
  return (
    <Button type="submit" disabled={pending || disabled} aria-busy={pending || undefined} {...props}>
      {pending && <LoaderCircle className="animate-spin" aria-hidden />}
      {pending ? pendingLabel : children}
    </Button>
  );
}
