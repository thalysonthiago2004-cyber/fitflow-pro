import { z } from "zod";

// PAR-Q (Physical Activity Readiness Questionnaire), Portuguese version widely
// used in Brazil. Any "yes" means medical clearance is recommended before
// starting or intensifying exercise. It is a screening tool, not a diagnosis.
export const PARQ_QUESTIONS = [
  { key: "q1", text: "Algum médico já disse que você possui algum problema de coração e que só deveria realizar atividade física supervisionada por profissionais de saúde?" },
  { key: "q2", text: "Você sente dores no peito quando pratica atividade física?" },
  { key: "q3", text: "No último mês, você sentiu dores no peito quando praticou atividade física?" },
  { key: "q4", text: "Você apresenta desequilíbrio devido a tontura e/ou perda de consciência?" },
  { key: "q5", text: "Você possui algum problema ósseo ou articular que poderia ser piorado pela atividade física?" },
  { key: "q6", text: "Você toma atualmente algum medicamento para pressão arterial e/ou problema de coração?" },
  { key: "q7", text: "Sabe de alguma outra razão pela qual você não deve praticar atividade física?" },
] as const;

export const PARQ_DETAILS = [
  { key: "medications", label: "Medicamentos de uso contínuo", placeholder: "Ex.: losartana 50 mg, 1x ao dia" },
  { key: "conditions", label: "Doenças ou condições de saúde", placeholder: "Ex.: asma, diabetes tipo 2, hipertensão" },
  { key: "injuries", label: "Lesões, dores ou cirurgias", placeholder: "Ex.: cirurgia no joelho direito em 2023" },
  { key: "notes", label: "Algo mais que seu personal deva saber", placeholder: "Ex.: rotina de sono, gestação, histórico na academia" },
] as const;

type QuestionKey = (typeof PARQ_QUESTIONS)[number]["key"];
type DetailKey = (typeof PARQ_DETAILS)[number]["key"];

const answer = z.enum(["yes", "no"], { error: "Responda sim ou não." });
const detail = z.string().trim().max(500, "Use no máximo 500 caracteres.").transform((v) => v || null);

export const parqSchema = z
  .object({
    ...(Object.fromEntries(PARQ_QUESTIONS.map((q) => [q.key, answer])) as Record<QuestionKey, typeof answer>),
    ...(Object.fromEntries(PARQ_DETAILS.map((d) => [d.key, detail])) as Record<DetailKey, typeof detail>),
  })
  .transform((answers) => ({ answers, needsClearance: PARQ_QUESTIONS.some((q) => answers[q.key] === "yes") }));

export type ParqAnswers = z.output<typeof parqSchema>["answers"];
