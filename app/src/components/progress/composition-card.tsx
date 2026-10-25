import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ageFromBirthDate, formatDate, formatNumber } from "@/lib/format";
import { type MissingInput, estimateComposition } from "@/lib/progress/composition";
import type { BodyProfile, Measurement } from "@/lib/progress/queries";
import { fieldsFor, formatMeasure } from "@/lib/progress/schemas";

const MISSING_LABELS: Record<MissingInput, string> = {
  sex: "sexo",
  heightCm: "altura",
  age: "data de nascimento",
  weightKg: "peso",
  neckCm: "pescoço",
  waistCm: "cintura",
  hipCm: "quadril",
};
const ON_RECORD: MissingInput[] = ["sex", "heightCm", "age"];

function Stat({ label, value, note }: { label: string; value: string | null; note: string }) {
  return (
    <div className="grid gap-1 rounded-lg border p-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-heading text-2xl font-semibold tabular-nums">{value ?? "—"}</span>
      <span className="text-xs text-muted-foreground">{note}</span>
    </div>
  );
}

// Quick assessment from tape measurements plus the latest bioimpedance reading.
// Estimates are calculated on the fly and never stored as measurements.
export function CompositionCard({ measurements, profile, isStudent }: { measurements: Measurement[]; profile: BodyProfile; isStudent: boolean }) {
  // Newest first. Circumferences come from one session so they match each other.
  const tape = measurements.find((m) => m.neckCm !== null && m.waistCm !== null && (profile.sex === "male" || m.hipCm !== null));
  const weight = measurements.find((m) => m.weightKg !== null);
  const scale = measurements.find((m) => m.source === "bioimpedance");

  const estimate = estimateComposition({
    sex: profile.sex,
    heightCm: profile.heightCm,
    age: profile.birthDate ? ageFromBirthDate(profile.birthDate) : null,
    weightKg: weight?.weightKg ?? null,
    neckCm: tape?.neckCm ?? null,
    waistCm: tape?.waistCm ?? null,
    hipCm: tape?.hipCm ?? null,
  });

  const missingRecord = estimate.missing.filter((m) => ON_RECORD.includes(m));
  const missingMeasures = estimate.missing.filter((m) => !ON_RECORD.includes(m));
  const list = (items: MissingInput[]) => new Intl.ListFormat("pt-BR").format(items.map((m) => MISSING_LABELS[m]));
  const basis = [weight && `peso de ${formatDate(weight.measuredOn)}`, tape && `circunferências de ${formatDate(tape.measuredOn)}`].filter(Boolean).join(" e ");

  return (
    <Card id="avaliacao" className="scroll-mt-20 gap-4 py-6 [--card-spacing:--spacing(6)]">
      <CardHeader>
        <CardTitle className="text-lg font-semibold"><h2>Avaliação corporal rápida</h2></CardTitle>
        <CardDescription>
          Estimativas calculadas a partir das medidas registradas (gordura pelo método da Marinha dos EUA, TMB por Mifflin-St Jeor).
          Não substituem bioimpedância, dobras cutâneas ou avaliação profissional.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="IMC" value={estimate.bmi === null ? null : formatNumber(estimate.bmi, 1)} note="Calculado" />
          <Stat label="Gordura" value={estimate.bodyFatPct === null ? null : `${formatNumber(estimate.bodyFatPct, 1)}%`} note="Estimativa" />
          <Stat label="Massa gorda" value={estimate.fatMassKg === null ? null : `${formatNumber(estimate.fatMassKg, 1)} kg`} note="Estimativa" />
          <Stat label="Massa magra" value={estimate.leanMassKg === null ? null : `${formatNumber(estimate.leanMassKg, 1)} kg`} note="Estimativa" />
          <Stat label="TMB" value={estimate.bmrKcal === null ? null : `${formatNumber(estimate.bmrKcal, 0)} kcal`} note="Estimativa por dia" />
        </div>
        {basis && <p className="text-xs text-muted-foreground">Usando {basis}.</p>}
        {missingMeasures.length > 0 && (
          <p className="text-sm text-muted-foreground">Para completar, registre {list(missingMeasures)} na aba “Fita métrica e peso”.</p>
        )}
        {missingRecord.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Falta {list(missingRecord)} na ficha do aluno{isStudent ? " — peça ao seu personal para preencher." : "."}
          </p>
        )}

        {scale && (
          <div className="grid gap-2 border-t pt-4">
            <h3 className="font-medium">Última bioimpedância · {formatDate(scale.measuredOn)}</h3>
            <p className="text-sm tabular-nums">
              {fieldsFor("bioimpedance").filter((f) => scale[f.key] !== null)
                .map((f) => `${f.short}: ${formatMeasure(f, scale[f.key] as number)}`)
                .join(" · ")}
            </p>
            <p className="text-xs text-muted-foreground">Valores informados a partir do aparelho, registrados por {scale.recordedByName}.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
