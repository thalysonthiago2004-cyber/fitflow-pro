import type { Metadata } from "next";
import { Suspense } from "react";
import { Droplets, X } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { HydrationMeter } from "@/components/hydration/hydration-meter";
import { QuickAdd } from "@/components/hydration/quick-add";
import { ReminderSettings } from "@/components/hydration/reminder-settings";
import { WeekChart } from "@/components/hydration/week-chart";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/dal";
import { formatVolume } from "@/lib/format";
import { getCurrentGoal, getDailyTotals, getReminders, getTodayEntries } from "@/lib/hydration/queries";
import { redirect } from "next/navigation";
import { RemoveWaterButton } from "./remove-water-button";

export const metadata: Metadata = { title: "Hidratação" };

const timeFormat = new Intl.DateTimeFormat("pt-BR", { timeStyle: "short", timeZone: "America/Sao_Paulo" });

async function HydrationContent() {
  const user = await requireUser();
  if (user.role !== "student") redirect("/dashboard");
  if (!user.workspace) {
    return <EmptyState icon={Droplets} title="Você ainda não tem um personal" description="A meta de hidratação é definida pelo seu personal." />;
  }

  const [goal, days, entries, reminders] = await Promise.all([
    getCurrentGoal(user.id),
    getDailyTotals(user.id, 7),
    getTodayEntries(user.id),
    getReminders(user.id),
  ]);
  const today = days[days.length - 1].totalMl;

  return (
    <div className="grid gap-6">
      <Card className="gap-6 py-6 [--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle className="text-lg font-semibold"><h2>Hoje</h2></CardTitle>
          <CardDescription>
            {goal ? "Meta diária definida pelo seu personal. É uma referência, não uma prescrição médica." : "Seu personal ainda não definiu uma meta. Você já pode registrar o que beber."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <HydrationMeter totalMl={today} goalMl={goal} />
          <QuickAdd />
        </CardContent>
      </Card>

      <Card className="gap-4 py-6 [--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle className="text-lg font-semibold"><h2>Registros de hoje</h2></CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum registro hoje.</p>
          ) : (
            <ul className="grid gap-1">
              {entries.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-3 border-b py-1 last:border-0">
                  <span className="text-sm tabular-nums">
                    <span className="font-medium">{formatVolume(entry.amountMl)}</span>
                    <span className="text-muted-foreground"> · {timeFormat.format(new Date(entry.loggedAt))}</span>
                  </span>
                  <RemoveWaterButton entryId={entry.id} label={`${formatVolume(entry.amountMl)} às ${timeFormat.format(new Date(entry.loggedAt))}`} icon={<X aria-hidden />} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="py-6 [--card-spacing:--spacing(6)]">
        <CardContent>
          <WeekChart days={days} goalMl={goal} />
        </CardContent>
      </Card>

      <Card className="gap-6 py-6 [--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle className="text-lg font-semibold"><h2>Lembretes</h2></CardTitle>
        </CardHeader>
        <CardContent>
          <ReminderSettings prefs={reminders} />
        </CardContent>
      </Card>
    </div>
  );
}

export default function HydrationPage() {
  return (
    <div className="grid max-w-3xl gap-8">
      <PageHeader title="Hidratação" description="Registre a água que você bebe ao longo do dia." />
      <Suspense fallback={<div role="status" className="h-96 animate-pulse rounded-2xl bg-muted" aria-label="Carregando hidratação" />}>
        <HydrationContent />
      </Suspense>
    </div>
  );
}
