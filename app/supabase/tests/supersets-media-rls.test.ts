import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type TestDb, createTestDb, uid } from "./harness";

const TRAINER_A = uid("a");
const TRAINER_B = uid("b");
const STUDENT_1 = uid("a1");

let t: TestDb;
let wsA: string;
let wsB: string;
let session: string;
let french: string;
let dips: string;
let treadmill: string;

async function one<T>(user: string, sql: string, params: unknown[] = []): Promise<T> {
  const { rows } = await t.asUser(user, () => t.db.query<T>(sql, params));
  return rows[0];
}

const exerciseId = async (name: string) =>
  (await t.db.query<{ id: string }>("select id from public.exercises where name = $1 and workspace_id is null", [name])).rows[0].id;

const STRENGTH = `insert into public.session_exercises (workspace_id, session_id, exercise_id, sets, reps_min, reps_max, reps_per_set, superset_group)
  values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`;

beforeAll(async () => {
  t = await createTestDb();
  await t.createAuthUser(TRAINER_A, "ana@example.com", { full_name: "Ana Souza" });
  await t.createAuthUser(TRAINER_B, "bruno@example.com", { full_name: "Bruno Lima" });
  wsA = await t.workspaceOf(TRAINER_A);
  wsB = await t.workspaceOf(TRAINER_B);
  const { rows } = await t.asUser(TRAINER_A, () =>
    t.db.query<{ token: string }>("select * from public.create_student_invitation($1, 'carla@example.com', 'Carla')", [wsA]),
  );
  await t.createAuthUser(STUDENT_1, "carla@example.com", { invite_token: rows[0].token });
  french = await exerciseId("Tríceps francês com halter");
  dips = await exerciseId("Mergulho no banco");
  treadmill = await exerciseId("Esteira");

  const plan = await one<{ id: string }>(
    TRAINER_A,
    "insert into public.workout_plans (workspace_id, student_id, name, status, created_by) values ($1, $2, 'Plano', 'active', $3) returning id",
    [wsA, STUDENT_1, TRAINER_A],
  );
  session = (
    await one<{ id: string }>(TRAINER_A, "insert into public.workout_sessions (workspace_id, plan_id, name) values ($1, $2, 'Treino A') returning id", [wsA, plan.id])
  ).id;
}, 60_000);

afterAll(() => t?.close());

describe("supersets and per-set reps", () => {
  it("groups strength exercises with per-set repetitions", async () => {
    const group = randomUUID();
    await one(TRAINER_A, STRENGTH, [wsA, session, french, 3, 8, 12, "{12,10,8}", group]);
    await one(TRAINER_A, STRENGTH, [wsA, session, dips, 3, 15, 15, null, group]);
    const { rows } = await t.asUser(STUDENT_1, () =>
      t.db.query("select 1 from public.session_exercises where superset_group = $1", [group]),
    );
    expect(rows).toHaveLength(2);
  });

  it("per-set reps must match the number of sets and stay in range", async () => {
    await expect(t.asUser(TRAINER_A, () => t.db.query(STRENGTH, [wsA, session, french, 3, 8, 12, "{12,10}", null]))).rejects.toThrow(/check constraint/);
    await expect(t.asUser(TRAINER_A, () => t.db.query(STRENGTH, [wsA, session, french, 2, 8, 12, "{12,0}", null]))).rejects.toThrow(/check constraint/);
  });

  it("cardio cannot join a superset", async () => {
    await expect(
      t.asUser(TRAINER_A, () =>
        t.db.query(
          "insert into public.session_exercises (workspace_id, session_id, exercise_id, cardio_mode, duration_minutes, superset_group) values ($1, $2, $3, 'continuous', 10, $4)",
          [wsA, session, treadmill, randomUUID()],
        ),
      ),
    ).rejects.toThrow(/check constraint/);
  });
});

describe("exercise customizations", () => {
  const UPSERT = `insert into public.exercise_customizations (workspace_id, exercise_id, instructions, video_url, updated_by)
    values ($1, $2, 'Cotovelos apontados para cima.', 'https://youtu.be/abcdefgh', $3)`;

  it("staff customize a global exercise for their workspace only", async () => {
    await t.asUser(TRAINER_A, () => t.db.query(UPSERT, [wsA, french, TRAINER_A]));
    await expect(t.asUser(TRAINER_B, () => t.db.query(UPSERT, [wsA, dips, TRAINER_B]))).rejects.toThrow(/row-level security/);
    await expect(t.asUser(STUDENT_1, () => t.db.query(UPSERT, [wsA, dips, STUDENT_1]))).rejects.toThrow(/row-level security/);
  });

  it("only global exercises can be customized", async () => {
    const own = await one<{ id: string }>(
      TRAINER_A,
      "insert into public.exercises (workspace_id, name, muscle_group, equipment, created_by) values ($1, 'Tríceps coice', 'triceps', 'dumbbell', $2) returning id",
      [wsA, TRAINER_A],
    );
    await expect(t.asUser(TRAINER_A, () => t.db.query(UPSERT, [wsA, own.id, TRAINER_A]))).rejects.toThrow(/row-level security/);
  });

  it("students of the workspace read it; other workspaces do not", async () => {
    expect((await t.asUser(STUDENT_1, () => t.db.query("select 1 from public.exercise_customizations"))).rows).toHaveLength(1);
    expect((await t.asUser(TRAINER_B, () => t.db.query("select 1 from public.exercise_customizations"))).rows).toHaveLength(0);
  });
});

describe("exercise videos", () => {
  const put = (name: string) => t.db.query("insert into storage.objects (bucket_id, name) values ('exercise-videos', $1)", [name]);

  it("staff upload into their workspace folder; students and other trainers cannot", async () => {
    await t.asUser(TRAINER_A, () => put(`${wsA}/${randomUUID()}.mp4`));
    await expect(t.asUser(STUDENT_1, () => put(`${wsA}/${randomUUID()}.mp4`))).rejects.toThrow(/row-level security/);
    await expect(t.asUser(TRAINER_B, () => put(`${wsA}/${randomUUID()}.mp4`))).rejects.toThrow(/row-level security/);
    await expect(t.asUser(TRAINER_A, () => put(`${wsB}/${randomUUID()}.mp4`))).rejects.toThrow(/row-level security/);
  });

  it("workspace members watch; other workspaces do not", async () => {
    const watch = "select 1 from storage.objects where bucket_id = 'exercise-videos'";
    expect((await t.asUser(STUDENT_1, () => t.db.query(watch))).rows).toHaveLength(1);
    expect((await t.asUser(TRAINER_B, () => t.db.query(watch))).rows).toHaveLength(0);
  });

  it("an exercise only points at its own workspace's folder", async () => {
    await expect(
      t.asUser(TRAINER_B, () =>
        t.db.query(
          "insert into public.exercises (workspace_id, name, muscle_group, equipment, created_by, video_path) values ($1, 'Rosca X', 'biceps', 'dumbbell', $2, $3)",
          [wsB, TRAINER_B, `${wsA}/${randomUUID()}.mp4`],
        ),
      ),
    ).rejects.toThrow(/check constraint/);
  });
});
