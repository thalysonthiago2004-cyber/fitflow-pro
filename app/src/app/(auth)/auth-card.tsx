import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from "@/components/ui/card";

type AuthCardProps = {
  title: string;
  description: string;
  children?: ReactNode;
  footer?: ReactNode;
};

export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <Card className="gap-6 rounded-3xl py-7 shadow-sm [--card-spacing:--spacing(6)] sm:[--card-spacing:--spacing(8)]">
      <CardHeader>
        <h1 className="font-heading text-3xl font-extrabold tracking-tight">{title}</h1>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {children && <CardContent>{children}</CardContent>}
      {footer && (
        <CardFooter className="justify-center text-sm text-muted-foreground">{footer}</CardFooter>
      )}
    </Card>
  );
}
