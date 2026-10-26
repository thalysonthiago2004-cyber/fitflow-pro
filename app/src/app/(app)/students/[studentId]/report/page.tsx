import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { PrintButton } from "@/components/print-button";
import { CompositionCard } from "@/components/progress/composition-card";
import { WeightChart } from "@/components/progress/weight-chart";
import { QuestionnaireSummary } from "@/components/students/questionnaire-summary";
import { requireStaff } from "@/lib/auth/dal";
import { formatDate, formatLongDate, formatNumber, todayISO } from "@/lib/format";
import { delta } from "@/lib/progress/calc";
import { listProgressPhotos } from "@/lib/progress/photos";
import { getBodyProfile, getStrengthProgress, getWeeklyWorkouts, listMeasurements } from "@/lib/progress/queries";
import { MEASUREMENT_FIELDS, POSE_LABELS, formatMeasure } from "@/lib/progress/schemas";
import { getLatestQuestionnaire } from "@/lib/students/questionnaire-queries";
import { getStudent } from "@/lib/students/queries";

export const metadata: Metadata = { title: "Relatório do aluno" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3 break-inside-avoid">
      <h2 className="border-b pb-1 font-heading text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

async function Report({ params }: Pick<PageProps<"/students/[studentId]/report">, "params">) {
  const { studentId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(studentId)) notFound();
  const user = await requireStaff();
  const student = await getStudent(user.workspace.id, studentId);
  if (!student) notFound();
  const [measurements, profile, strength, weeks, photos, questionnaire] = await Promise.all([
    listMeasurements(studentId),
    getBodyProfile(studentId),
    getStrengthProgress(studentId),
    getWeeklyWorkouts(studentId, 8),
    listProgressPhotos(studentId),
    getLatestQuestionnaire(studentId),
  ]);
  const chronological = [...measurements].reverse();
  const rows = MEASUREMENT_FIELDS.flatMap((f) => {
    const values = chronological.filter((m) => m[f.key] !== null);
    if (values.length === 0) return [];
    const first = values[0];
    const last = values.at(-1)!;
    const change = values.length > 1 ? delta(last[f.key], first[f.key]) : null;
    return [{ field: f, first, last, change }];
  });
  const weight = chronological.filter((m) => m.weightKg !== null).map((m) => ({ date: m.measuredOn, value: m.weightKg! }));
  const workouts = weeks.reduce((sum, w) => sum + w.count, 0);

  return (
    <div className="grid gap-8">
      <header className="grid gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <h1 className="font-heading text-3xl font-extrabold tracking-tight">Relatório de evolução</h1>
            <p className="text-lg font-semibold">{student.fullName}</p>
            <p className="text-sm text-muted-foreground">
              Personal: {user.fullName} · {user.workspace.name} · gerado em {formatLongDate(todayISO())}
            </p>
          </div>
          <PrintButton />
        </div>
      </header>

      <Section title="Avaliação corporal">
        <CompositionCard measurements={measurements} profile={profile} isStudent={false} />
      </Section>

      <Section title="Medidas">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma medição registrada.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 font-medium">Medida</th>
                <th className="py-1 font-medium">Primeira</th>
                <th className="py-1 font-medium">Última</th>
                <th className="py-1 font-medium">Variação</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ field, first, last, change }) => (
                <tr key={field.key} className="border-t tabular-nums">
                  <td className="py-1.5">{field.short}</td>
                  <td className="py-1.5">{formatMeasure(field, first[field.key]!)} <span className="text-xs text-muted-foreground">{formatDate(first.measuredOn)}</span></td>
                  <td className="py-1.5">{formatMeasure(field, last[field.key]!)} <span className="text-xs text-muted-foreground">{formatDate(last.measuredOn)}</span></td>
                  <td className="py-1.5">{change === null ? "—" : `${change > 0 ? "+" : change < 0 ? "−" : "±"}${formatNumber(Math.abs(change), 1)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <WeightChart points={weight} />
      </Section>

      {photos.length > 0 && (
        <Section title="Antes e depois">
          <div className="grid gap-4 sm:grid-cols-3">
            {(Object.keys(POSE_LABELS) as (keyof typeof POSE_LABELS)[]).map((pose) => {
              const ofPose = photos.filter((p) => p.pose === pose);
              if (ofPose.length === 0) return null;
              const pair = ofPose.length > 1 ? [ofPose[0], ofPose.at(-1)!] : [ofPose[0]];
              return (
                <figure key={pose} className="grid gap-2">
                  <figcaption className="text-sm font-semibold">{POSE_LABELS[pose]}</figcaption>
                  <div className="grid grid-cols-2 gap-2">
                    {pair.map((p) => (
                      <div key={p.id} className="grid gap-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.url} alt={`${POSE_LABELS[pose]} em ${formatDate(p.takenOn)}`} className="aspect-[3/4] w-full rounded-lg border object-cover" />
                        <span className="text-xs text-muted-foreground tabular-nums">{formatDate(p.takenOn)}</span>
                      </div>
                    ))}
                  </div>
                </figure>
              );
            })}
          </div>
        </Section>
      )}

      <Section title="Treinos e força">
        <p className="text-sm">
          <span className="font-semibold tabular-nums">{workouts}</span> treinos concluídos nas últimas 8 semanas.
        </p>
        {strength.records.length > 0 && (
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {strength.records.slice(0, 12).map((r) => (
              <li key={r.exerciseId} className="tabular-nums">
                <span className="font-medium">{r.exerciseName}:</span> {formatNumber(r.loadKg, 2)} kg{r.reps ? ` × ${r.reps}` : ""} ({formatDate(r.date)})
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Anamnese">
        {questionnaire ? <QuestionnaireSummary questionnaire={questionnaire} /> : <p className="text-sm text-muted-foreground">Não respondida.</p>}
      </Section>

      <p className="text-xs text-muted-foreground">
        Valores calculados são estimativas e não substituem avaliação médica ou nutricional. Dados pessoais de saúde: compartilhe apenas com o aluno.
      </p>
    </div>
  );
}

export default function StudentReportPage({ params }: PageProps<"/students/[studentId]/report">) {
  return (
    <div className="grid max-w-4xl gap-6">
      <Link href="/students" className="inline-flex w-fit items-center gap-1 rounded-sm text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 print:hidden">
        <ArrowLeft className="size-4" aria-hidden />
        Alunos
      </Link>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" aria-label="Carregando relatório" />}>
        <Report params={params} />
      </Suspense>
    </div>
  );
}
