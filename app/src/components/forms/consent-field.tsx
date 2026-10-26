import type { ReactNode } from "react";

type Props = { name: string; id?: string; children: ReactNode; errors?: string[] };

// Native checkbox so the value travels with FormData; the label is the text.
export function ConsentField({ name, id: idProp, children, errors }: Props) {
  const id = idProp ?? `field-${name}`;
  const errorId = errors?.length ? `${id}-error` : undefined;
  return (
    <div className="grid gap-1.5">
      <div className="flex items-start gap-3">
        <input
          id={id}
          name={name}
          type="checkbox"
          value="yes"
          aria-invalid={errorId ? true : undefined}
          aria-describedby={errorId}
          className="mt-0.5 size-5 shrink-0 accent-[var(--brand)] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <label htmlFor={id} className="text-sm leading-snug text-muted-foreground">{children}</label>
      </div>
      {errorId && <p id={errorId} className="pl-8 text-sm text-destructive">{errors![0]}</p>}
    </div>
  );
}
