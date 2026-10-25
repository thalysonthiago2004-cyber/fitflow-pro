import { CircleAlert, CircleCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { FormState } from "@/lib/auth/schemas";

// Form-level feedback. Icon and text carry the status, not color alone.
export function FormMessage({ state }: { state: FormState }) {
  if (state.status === "idle" || !state.message) return null;
  const isError = state.status === "error";

  return (
    <Alert variant={isError ? "destructive" : "default"} aria-live="polite">
      {isError ? <CircleAlert aria-hidden /> : <CircleCheck aria-hidden className="text-success" />}
      <AlertDescription className={isError ? undefined : "text-foreground"}>
        {state.message}
      </AlertDescription>
    </Alert>
  );
}
