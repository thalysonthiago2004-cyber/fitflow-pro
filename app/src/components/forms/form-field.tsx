import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "./password-input";

type FormFieldProps = Omit<ComponentProps<typeof Input>, "id" | "name"> & {
  name: string;
  /** Defaults to `field-<name>`; set it when the same name appears in several forms. */
  id?: string;
  label: string;
  hint?: string;
  errors?: string[];
};

// Label, input, hint and validation message wired together for assistive tech.
export function FormField({ name, id: idProp, label, hint, errors, ...inputProps }: FormFieldProps) {
  const id = idProp ?? `field-${name}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = errors?.length ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  const Control = inputProps.type === "password" ? PasswordInput : Input;

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Control
        id={id}
        name={name}
        aria-invalid={errorId ? true : undefined}
        aria-describedby={describedBy}
        {...inputProps}
      />
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {errorId && (
        <p id={errorId} className="text-sm text-destructive">
          {errors![0]}
        </p>
      )}
    </div>
  );
}
