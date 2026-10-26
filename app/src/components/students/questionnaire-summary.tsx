import { CircleAlert, CircleCheck } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { PARQ_DETAILS, PARQ_QUESTIONS } from "@/lib/students/parq";
import type { Questionnaire } from "@/lib/students/questionnaire-queries";

// Read-only view of the latest answers, with "yes" answers first and marked.
export function QuestionnaireSummary({ questionnaire }: { questionnaire: Questionnaire }) {
  const yes = PARQ_QUESTIONS.filter((q) => questionnaire.answers[q.key] === "yes");
  const details = PARQ_DETAILS.filter((d) => questionnaire.answers[d.key]);
  return (
    <div className="grid gap-4">
      {questionnaire.needsClearance ? (
        <p className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          {yes.length} {yes.length === 1 ? "resposta indica" : "respostas indicam"} que é recomendada liberação médica antes de iniciar ou intensificar os treinos.
        </p>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CircleCheck className="size-4 shrink-0 text-success" aria-hidden />
          Todas as respostas do PAR-Q foram &quot;não&quot;.
        </p>
      )}
      {yes.length > 0 && (
        <ul className="grid gap-1.5 text-sm">
          {yes.map((q) => <li key={q.key} className="rounded-lg bg-muted/60 p-2.5"><span className="font-semibold">Sim:</span> {q.text}</li>)}
        </ul>
      )}
      {details.length > 0 && (
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {details.map((d) => (
            <div key={d.key} className="grid gap-0.5">
              <dt className="text-xs text-muted-foreground">{d.label}</dt>
              <dd className="whitespace-pre-line">{questionnaire.answers[d.key]}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="text-xs text-muted-foreground">Respondido em {formatDateTime(questionnaire.submittedAt)}. Triagem informada pelo aluno; não substitui avaliação médica.</p>
    </div>
  );
}
