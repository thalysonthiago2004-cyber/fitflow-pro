import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type SelectFieldProps = Omit<ComponentProps<"select">, "id" | "name"> & {
  name: string;
  id?: string;
  label: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  hint?: string;
  errors?: string[];
};

// Native <select>: works with FormData, uses the platform picker on mobile and
// is accessible without extra wiring.
export function SelectField({ name, id: idProp, label, options, placeholder, hint, errors, className, ...props }: SelectFieldProps) {
  const id = idProp ?? `field-${name}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = errors?.length ? `${id}-error` : undefined;

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <select
          id={id}
          name={name}
          aria-invalid={errorId ? true : undefined}
          aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
          className={cn(
            "h-11 w-full appearance-none rounded-lg border border-input bg-transparent pr-10 pl-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 [&>option]:bg-popover [&>option]:text-popover-foreground",
            className,
          )}
          {...props}
        >
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      </div>
      {hint && <p id={hintId} className="text-xs text-muted-foreground">{hint}</p>}
      {errorId && <p id={errorId} className="text-sm text-destructive">{errors![0]}</p>}
    </div>
  );
}
