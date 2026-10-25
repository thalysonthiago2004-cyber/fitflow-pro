import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type TestDb, createTestDb, uid } from "./harness";

const TRAINER_A = uid("a");
const TRAINER_B = uid("b");
const STUDENT_1 = uid("a1");
const STUDENT_2 = uid("a2");

let t: TestDb;
let wsA: string;
let session: string;
let treadmill: string;
let squat: string;
let cardioItem: string;
let log: string;

async function enroll(id: string, email: string) {
  const { rows } = await t.asUser(TRAINER_A, () =>
    t.db.query<{ token: string }>("select * from public.create_student_invitation($1, $2, 'Aluno X')", [wsA, email]),
  );
  await t.createAuthUser(id, email, { full_name: "Aluno X", invite_token: rows[0].token });
}

async function one<T>(user: string, sql: string, params: unknown[] = []): Promise<T> {
  const { rows } = await t.asUser(user, () => t.db.query<T>(sql, params));
  return rows[0];
}

const exerciseId = async (name: string) =>
  (await t.db.query<{ id: string }>("select id from public.exercises where name = $1 and workspace_id is null", [name])).rows[0].id;

const CARDIO = `insert into public.session_exercises (workspace_id, session_id, exercise_id, cardio_mode, duration_minutes, rounds, work_seconds, rest_seconds, intensity)
  values ($1, $2, $3, $4, $5, $6, $7, $8, 'moderate') returning id, kind`;

beforeAll(async () => {
  t = await createTestDb();
  await t.createAuthUser(TRAINER_A, "ana@example.com", { full_name: "Ana Souza" });
  await t.createAuthUser(TRAINER_B, "bruno@example.com", { full_name: "Bruno Lima" });
  wsA = await t.workspaceOf(TRAINER_A);
  await enroll(STUDENT_1, "carla@example.com");
  await enroll(STUDENT_2, "diego@example.com");
  treadmill = await exerciseId("Esteira");
  squat = await exerciseId("Agachamento livre");

  const plan = await one<{ id: string }>(
    TRAINER_A,
    "insert into public.workout_plans (workspace_id, student_id, name, status, created_by) values ($1, $2, 'Plano', 'active', $3) returning id",
    [wsA, STUDENT_1, TRAINER_A],
  );
  session = (
    await one<{ id: string }>(TRAINER_A, "insert into public.workout_sessions (workspace_id, plan_id, name) values ($1, $2, 'Treino A') returning id", [wsA, plan.id])
  ).id;
  log = (
    await one<{ id: string }>(STUDENT_1, "insert into public.workout_logs (workspace_id, student_id, plan_id, session_id) values ($1, $2, $3, $4) returning id", [
      wsA,
      STUDENT_1,
      plan.id,
      session,
    ])
  ).id;
}, 60_000);

afterAll(() => t?.close());

describe("cardio prescriptions", () => {
  it("the kind follows the exercise, not the client", async () => {
    const row = await one<{ id: string; kind: string }>(TRAINER_A, CARDIO, [wsA, session, treadmill, "continuous", 30, null, null, null]);
    expect(row.kind).toBe("cardio");
    cardioItem = row.id;
    await expect(
      t.asUser(TRAINER_A, () => t.db.query("update public.session_exercises set kind = 'strength' where id = $1", [cardioItem])),
    ).rejects.toThrow(/permission denied/);
  });

  it("intervals need rounds and work time; continuous needs duration or distance", async () => {
    const intervals = await one<{ kind: string }>(TRAINER_A, CARDIO, [wsA, session, treadmill, "intervals", null, 8, 60, 90]);
    expect(intervals.kind).toBe("cardio");
    await expect(t.asUser(TRAINER_A, () => t.db.query(CARDIO, [wsA, session, treadmill, "intervals", null, 8, null, 90]))).rejects.toThrow(/check constraint/);
    await expect(t.asUser(TRAINER_A, () => t.db.query(CARDIO, [wsA, session, treadmill, "continuous", null, null, null, null]))).rejects.toThrow(/check constraint/);
  });

  it("strength exercises still need sets and reps, and cannot carry cardio targets", async () => {
    await expect(t.asUser(TRAINER_A, () => t.db.query(CARDIO, [wsA, session, squat, "continuous", 30, null, null, null]))).rejects.toThrow(/check constraint/);
    await expect(
      t.asUser(TRAINER_A, () =>
        t.db.query("insert into public.session_exercises (workspace_id, session_id, exercise_id, sets, reps_min) values ($1, $2, $3, 3, 10)", [wsA, session, treadmill]),
      ),
    ).rejects.toThrow(/check constraint/);
  });

  it("other trainers cannot add cardio to this workspace", async () => {
    await expect(t.asUser(TRAINER_B, () => t.db.query(CARDIO, [wsA, session, treadmill, "continuous", 30, null, null, null]))).rejects.toThrow(/row-level security/);
  });
});

describe("cardio logs", () => {
  const INSERT = "insert into public.cardio_logs (log_id, session_exercise_id, duration_minutes, distance_km, rpe) values ($1, $2, 28.5, 4.2, 6)";

  it("only the student records their cardio", async () => {
    await t.asUser(STUDENT_1, () => t.db.query(INSERT, [log, cardioItem]));
    await expect(t.asUser(TRAINER_A, () => t.db.query(INSERT, [log, cardioItem]))).rejects.toThrow(/row-level security/);
    await expect(t.asUser(STUDENT_2, () => t.db.query(INSERT, [log, cardioItem]))).rejects.toThrow(/row-level security/);
  });

  it("the student and their trainer read it; others do not", async () => {
    for (const [user, count] of [[STUDENT_1, 1], [TRAINER_A, 1], [STUDENT_2, 0], [TRAINER_B, 0]] as const) {
      const { rows } = await t.asUser(user, () => t.db.query("select 1 from public.cardio_logs"));
      expect(rows).toHaveLength(count);
    }
  });

  it("rejects implausible values", async () => {
    await expect(
      t.asUser(STUDENT_1, () => t.db.query("update public.cardio_logs set rpe = 11 where log_id = $1", [log])),
    ).rejects.toThrow(/check constraint/);
  });
});
