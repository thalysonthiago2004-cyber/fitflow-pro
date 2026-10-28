import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  /** Small uppercase line above the title (e.g. today's date). */
  eyebrow?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
};

// The one page title pattern: eyebrow, title, description, actions.
export function PageHeader({ title, eyebrow, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="grid gap-1.5">
        {eyebrow && <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{eyebrow}</p>}
        <h1 className="font-heading text-3xl leading-tight font-extrabold tracking-tight sm:text-4xl">{title}</h1>
        {description && <div className="text-sm text-muted-foreground sm:text-base">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
