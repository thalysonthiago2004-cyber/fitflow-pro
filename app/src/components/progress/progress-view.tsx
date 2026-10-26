import { Trophy } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatNumber } from "@/lib/format";
import { delta } from "@/lib/progress/calc";
import { listProgressPhotos } from "@/lib/progress/photos";
import { getBodyProfile, getStrengthProgress, getWeeklyWorkouts, listMeasurements, type Measurement } from "@/lib/progress/queries";
import { MEASUREMENT_FIELDS, type MeasurementKey, formatMeasure } from "@/lib/progress/schemas";
import { Badge } from "@/components/ui/badge";
import { CompositionCard } from "./composition-card";
import { LoadChart } from "./load-chart";
import { ProgressPhotos } from "./progress-photos";
import { DeleteMeasurementButton } from "./delete-measurement-button";
import { MeasurementEntry } from "./measurement-form";
import { WeeklyWorkoutsChart } from "./weekly-workouts-chart";
import { WeightChart } from "./weight-chart";

const TILES: { key: MeasurementKey; label: string; unit: string }[] = [
  { key: "weightKg", label: "Peso", unit: "kg" },
  { key: "bodyFatPct", label: "Gordura corporal", unit: "%" },
  { key: "waistCm", label: "Cintura", unit: "cm" },
];

function series(measurements: Measurement[], key: MeasurementKey) {
  return measurements.filter((m) => m[key] !== null).map((m) => ({ date: m.measuredOn, value: m[key] as number }));
}

function signed(n: number) {
  return `${n > 0 ? "+" : n < 0 ? "−" : "±"}${formatNumber(Math.abs(n), 1)}`;
}

// Progress for one student, shared by the student's page and the trainer view.
// Deltas are shown neutrally: whether "down" is good depends on the goal.
export async function ProgressView({ studentId, viewerId }: { studentId: string; viewerId: string }) {
  const [measurements, { records, series: loadSeries }, weeks, profile, photos] = await Promise.all([
    listMeasurements(studentId),
    getStrengthProgress(studentId),
    getWeeklyWorkouts(studentId, 8),
    getBodyProfile(studentId),
    listProgressPhotos(studentId),
  ]);
  const chronological = [...measurements].reverse();

  return (
    <div className="grid gap-6">
      <section aria-label="Medidas mais recentes" className="grid gap-3 sm:grid-cols-3">
        {TILES.map((tile) => {
          const s = series(chronological, tile.key);
          const last = s.at(-1);
          const prev = s.at(-2);
          const first = s[0];
          const change = delta(last?.value ?? null, prev?.value ?? null);
          const total = s.length > 2 ? delta(last?.value ?? null, first?.value ?? null) : null;
          return (
            <Card key={tile.key}>
              <CardHeader>
                <CardDescription>{tile.label}</CardDescription>
                <p className="font-heading text-3xl font-semibold tabular-nums">
                  {last ? `${formatNumber(last.value, 1)} ${tile.unit}` : "—"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {last ? `em ${formatDate(last.date)}` : "Sem registro"}
                  {change !== null && ` · ${signed(change)} ${tile.unit} desde a anterior`}
                  {total !== null && ` · ${signed(total)} ${tile.unit} desde ${formatDate(first.date)}`}
                </p>
              </CardHeader>
            </Card>
          );
        })}
      </section>

      <CompositionCard measurements={measurements} profile={profile} isStudent={viewerId === studentId} />

      <Card className="gap-6 py-6 [--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle className="text-lg font-semibold"><h2>Registrar medição ou bioimpedância</h2></CardTitle>
        </CardHeader>
        <CardContent><MeasurementEntry studentId={studentId} /></CardContent>
      </Card>

      <Card className="gap-4 py-6 [--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle className="text-lg font-semibold"><h2>Antes e depois</h2></CardTitle>
          <CardDescription>Compare fotos da mesma posição ao longo do tempo.</CardDescription>
        </CardHeader>
        <CardContent><ProgressPhotos photos={photos} canEdit={viewerId === studentId} /></CardContent>
      </Card>

      <Card className="py-6 [--card-spacing:--spacing(6)]">
        <CardContent><WeightChart points={series(chronological, "weightKg")} /></CardContent>
      </Card>

      <Card className="py-6 [--card-spacing:--spacing(6)]">
        <CardContent><WeeklyWorkoutsChart weeks={weeks} /></CardContent>
      </Card>

      <Card className="gap-4 py-6 [--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle className="text-lg font-semibold"><h2>Evolução de carga</h2></CardTitle>
          <CardDescription>Maior carga concluída em cada treino, por exercício.</CardDescription>
        </CardHeader>
        <CardContent><LoadChart series={loadSeries} /></CardContent>
      </Card>

      <Card className="gap-4 py-6 [--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle className="text-lg font-semibold"><h2>Recordes pessoais</h2></CardTitle>
          <CardDescription>Maior carga registrada em uma série concluída de cada exercício. Calculado a partir dos treinos registrados.</CardDescription>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <p className="text-sm text-muted-foreground">Os recordes aparecem quando houver séries concluídas com carga.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {records.map((r) => (
                <li key={r.exerciseId} className="flex items-center gap-3 rounded-lg border p-3">
                  <Trophy className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="grid min-w-0 flex-1">
                    <span className="truncate font-medium">{r.exerciseName}</span>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {formatNumber(r.loadKg, 2)} kg{r.reps ? ` × ${r.reps}` : ""} · {formatDate(r.date)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="gap-4 py-6 [--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle className="text-lg font-semibold"><h2>Histórico de medições</h2></CardTitle>
        </CardHeader>
        <CardContent>
          {measurements.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma medição registrada.</p>
          ) : (
            <ul className="grid gap-2">
              {measurements.map((m) => {
                const filled = MEASUREMENT_FIELDS.filter((f) => m[f.key] !== null);
                return (
                  <li key={m.id} className="flex items-start gap-3 rounded-lg border p-3">
                    <div className="grid min-w-0 flex-1 gap-1">
                      <p className="flex flex-wrap items-center gap-2 font-medium tabular-nums">
                        {formatDate(m.measuredOn)}
                        {m.source === "bioimpedance" && <Badge variant="secondary">Bioimpedância</Badge>}
                      </p>
                      <p className="text-sm tabular-nums">
                        {filled.map((f) => `${f.short}: ${formatMeasure(f, m[f.key] as number)}`).join(" · ")}
                      </p>
                      {m.notes && <p className="text-sm text-muted-foreground">{m.notes}</p>}
                      <p className="text-xs text-muted-foreground">Registrado por {m.recordedBy === viewerId ? "você" : m.recordedByName}</p>
                    </div>
                    {m.recordedBy === viewerId && <DeleteMeasurementButton measurementId={m.id} label={formatDate(m.measuredOn)} />}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
