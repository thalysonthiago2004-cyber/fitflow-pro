import type { ComponentProps } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type TextareaFieldProps = Omit<ComponentProps<typeof Textarea>, "id" | "name"> & {
  name: string;
  id?: string;
  label: string;
  hint?: string;
  errors?: string[];
};

export function TextareaField({ name, id: idProp, label, hint, errors, ...props }: TextareaFieldProps) {
  const id = idProp ?? `field-${name}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = errors?.length ? `${id}-error` : undefined;

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        name={name}
        aria-invalid={errorId ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        className="min-h-24 text-base md:text-sm"
        {...props}
      />
      {hint && <p id={hintId} className="text-xs text-muted-foreground">{hint}</p>}
      {errorId && <p id={errorId} className="text-sm text-destructive">{errors![0]}</p>}
    </div>
  );
}
