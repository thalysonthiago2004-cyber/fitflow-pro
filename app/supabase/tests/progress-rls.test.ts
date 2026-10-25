import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type TestDb, createTestDb, uid } from "./harness";

const TRAINER_A = uid("a");
const TRAINER_B = uid("b");
const STUDENT_1 = uid("a1");
const STUDENT_2 = uid("a2");

let t: TestDb;
let wsA: string;
let wsB: string;

const INSERT = `insert into public.body_measurements (workspace_id, student_id, measured_on, weight_kg, recorded_by)
  values ($1, $2, $3, $4, $5) returning id`;

async function enroll(id: string, email: string) {
  const { rows } = await t.asUser(TRAINER_A, () =>
    t.db.query<{ token: string }>("select * from public.create_student_invitation($1, $2, 'Aluno X')", [wsA, email]),
  );
  await t.createAuthUser(id, email, { invite_token: rows[0].token });
}

beforeAll(async () => {
  t = await createTestDb();
  await t.createAuthUser(TRAINER_A, "ana@example.com", { full_name: "Ana Souza" });
  await t.createAuthUser(TRAINER_B, "bruno@example.com", { full_name: "Bruno Lima" });
  wsA = await t.workspaceOf(TRAINER_A);
  wsB = await t.workspaceOf(TRAINER_B);
  await enroll(STUDENT_1, "carla@example.com");
  await enroll(STUDENT_2, "diego@example.com");
}, 60_000);

afterAll(() => t?.close());

describe("body measurements", () => {
  let byStudent: string;
  let byTrainer: string;

  it("the student and their trainer can record", async () => {
    byStudent = (await t.asUser(STUDENT_1, () => t.db.query<{ id: string }>(INSERT, [wsA, STUDENT_1, "2026-10-01", 72.4, STUDENT_1]))).rows[0].id;
    byTrainer = (await t.asUser(TRAINER_A, () => t.db.query<{ id: string }>(INSERT, [wsA, STUDENT_1, "2026-10-15", 71.8, TRAINER_A]))).rows[0].id;
    const { rows } = await t.asUser(STUDENT_1, () => t.db.query("select id from public.body_measurements"));
    expect(rows).toHaveLength(2);
  });

  it("nobody records under someone else's name or for another student", async () => {
    await expect(t.asUser(STUDENT_1, () => t.db.query(INSERT, [wsA, STUDENT_1, "2026-10-02", 70, TRAINER_A]))).rejects.toThrow(/row-level security/);
    await expect(t.asUser(STUDENT_2, () => t.db.query(INSERT, [wsA, STUDENT_1, "2026-10-02", 70, STUDENT_2]))).rejects.toThrow(/row-level security/);
    await expect(t.asUser(TRAINER_B, () => t.db.query(INSERT, [wsA, STUDENT_1, "2026-10-02", 70, TRAINER_B]))).rejects.toThrow(/row-level security/);
    await expect(t.asUser(TRAINER_B, () => t.db.query(INSERT, [wsB, STUDENT_1, "2026-10-02", 70, TRAINER_B]))).rejects.toThrow(/foreign key/);
  });

  it("other students and trainers cannot read", async () => {
    for (const user of [STUDENT_2, TRAINER_B]) {
      const { rows } = await t.asUser(user, () => t.db.query("select 1 from public.body_measurements"));
      expect(rows).toHaveLength(0);
    }
  });

  it("only the recorder edits or deletes", async () => {
    const studentEditsTrainer = await t.asUser(STUDENT_1, () => t.db.query("update public.body_measurements set weight_kg = 60 where id = $1", [byTrainer]));
    expect(studentEditsTrainer.affectedRows).toBe(0);
    const trainerDeletesStudent = await t.asUser(TRAINER_A, () => t.db.query("delete from public.body_measurements where id = $1", [byStudent]));
    expect(trainerDeletesStudent.affectedRows).toBe(0);
    const own = await t.asUser(STUDENT_1, () => t.db.query("update public.body_measurements set weight_kg = 72.2 where id = $1", [byStudent]));
    expect(own.affectedRows).toBe(1);
  });

  it("rejects future dates, empty rows and implausible values", async () => {
    await expect(t.asUser(STUDENT_1, () => t.db.query(INSERT, [wsA, STUDENT_1, "2099-01-01", 70, STUDENT_1]))).rejects.toThrow(/future_date/);
    await expect(t.asUser(STUDENT_1, () => t.db.query(INSERT, [wsA, STUDENT_1, "2026-10-03", null, STUDENT_1]))).rejects.toThrow(/check constraint/);
    await expect(t.asUser(STUDENT_1, () => t.db.query(INSERT, [wsA, STUDENT_1, "2026-10-03", 900, STUDENT_1]))).rejects.toThrow(/check constraint/);
  });

  it("the recorder cannot be reassigned", async () => {
    await expect(
      t.asUser(STUDENT_1, () => t.db.query("update public.body_measurements set recorded_by = $1 where id = $2", [TRAINER_A, byStudent])),
    ).rejects.toThrow(/permission denied/);
  });
});
