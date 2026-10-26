import { describe, expect, it } from "vitest";
import { attentionItems } from "./attention";

const student = (userId: string, joinedAt = "2026-09-01T10:00:00Z") => ({ userId, fullName: `Aluno ${userId}`, status: "active" as const, joinedAt });

describe("attentionItems", () => {
  const today = "2026-10-25";

  it("flags idle students, missing plans, plans ending soon and medical clearance", () => {
    const items = attentionItems({
      today,
      students: [student("a"), student("b"), student("c"), { ...student("d"), status: "archived" }],
      activePlans: [
        { id: "p1", studentId: "a", name: "Hipertrofia", endsOn: "2026-10-28" },
        { id: "p2", studentId: "b", name: "Força", endsOn: null },
      ],
      workoutDates: [
        { studentId: "a", date: "2026-10-24" },
        { studentId: "b", date: "2026-10-10" },
        { studentId: "b", date: "2026-10-15" },
      ],
      questionnaires: [{ studentId: "c", needsClearance: true }],
    });
    expect(items.map((i) => [i.studentId, i.reason])).toEqual([
      ["a", '"Hipertrofia" termina em 3 dias'],
      ["b", "Sem treinar há 10 dias"],
      ["c", "Anamnese indica liberação médica antes de treinar"],
      ["c", "Sem plano de treino ativo"],
    ]);
  });

  it("gives new students a week before calling them idle", () => {
    const items = attentionItems({
      today,
      students: [student("n", "2026-10-22T10:00:00Z")],
      activePlans: [{ id: "p", studentId: "n", name: "Início", endsOn: null }],
      workoutDates: [],
      questionnaires: [],
    });
    expect(items).toEqual([]);
  });
});
