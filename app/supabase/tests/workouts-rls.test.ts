import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type TestDb, createTestDb, uid } from "./harness";

const TRAINER_A = uid("a");
const TRAINER_B = uid("b");
const STUDENT_1 = uid("a1");
const STUDENT_2 = uid("a2");

let t: TestDb;
let wsA: string;
let wsB: string;
let globalExercise: string;
let planActive: string;
let planDraft: string;
let sessionA: string;
let prescribed: string;

async function enroll(trainer: string, ws: string, id: string, email: string) {
  const { rows } = await t.asUser(trainer, () =>
    t.db.query<{ token: string }>("select * from public.create_student_invitation($1, $2, 'Aluno X')", [ws, email]),
  );
  await t.createAuthUser(id, email, { full_name: "Aluno X", invite_token: rows[0].token });
}

async function one<T>(user: string, sql: string, params: unknown[] = []): Promise<T> {
  const { rows } = await t.asUser(user, () => t.db.query<T>(sql, params));
  return rows[0];
}

beforeAll(async () => {
  t = await createTestDb();
  await t.createAuthUser(TRAINER_A, "ana@example.com", { full_name: "Ana Souza" });
  await t.createAuthUser(TRAINER_B, "bruno@example.com", { full_name: "Bruno Lima" });
  wsA = await t.workspaceOf(TRAINER_A);
  wsB = await t.workspaceOf(TRAINER_B);
  await enroll(TRAINER_A, wsA, STUDENT_1, "carla@example.com");
  await enroll(TRAINER_A, wsA, STUDENT_2, "diego@example.com");

  globalExercise = (
    await t.db.query<{ id: string }>("select id from public.exercises where name = 'Agachamento livre'")
  ).rows[0].id;

  planActive = (
    await one<{ id: string }>(
      TRAINER_A,
      "insert into public.workout_plans (workspace_id, student_id, name, status, created_by) values ($1, $2, 'Hipertrofia', 'active', $3) returning id",
      [wsA, STUDENT_1, TRAINER_A],
    )
  ).id;
  planDraft = (
    await one<{ id: string }>(
      TRAINER_A,
      "insert into public.workout_plans (workspace_id, student_id, name, created_by) values ($1, $2, 'Rascunho', $3) returning id",
      [wsA, STUDENT_1, TRAINER_A],
    )
  ).id;
  sessionA = (
    await one<{ id: string }>(
      TRAINER_A,
      "insert into public.workout_sessions (workspace_id, plan_id, name, weekdays) values ($1, $2, 'Treino A', '{1,3,5}') returning id",
      [wsA, planActive],
    )
  ).id;
  prescribed = (
    await one<{ id: string }>(
      TRAINER_A,
      "insert into public.session_exercises (workspace_id, session_id, exercise_id, sets, reps_min, reps_max, load_kg, rest_seconds) values ($1, $2, $3, 4, 8, 12, 60, 90) returning id",
      [wsA, sessionA, globalExercise],
    )
  ).id;
}, 60_000);

afterAll(() => t?.close());

describe("exercise library", () => {
  it("everyone signed in sees the global catalog", async () => {
    for (const user of [TRAINER_A, STUDENT_1]) {
      const { rows } = await t.asUser(user, () => t.db.query("select id from public.exercises where workspace_id is null"));
      expect(rows.length).toBeGreaterThan(30);
    }
  });

  it("staff create exercises only in their own workspace", async () => {
    const created = await one<{ id: string }>(
      TRAINER_A,
      "insert into public.exercises (workspace_id, name, muscle_group, equipment, created_by) values ($1, 'Supino máquina articulada', 'chest', 'machine', $2) returning id",
      [wsA, TRAINER_A],
    );
    expect(created.id).toBeTruthy();

    await expect(
      t.asUser(TRAINER_B, () =>
        t.db.query(
          "insert into public.exercises (workspace_id, name, muscle_group, equipment, created_by) values ($1, 'Invasor', 'chest', 'machine', $2)",
          [wsA, TRAINER_B],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      t.asUser(STUDENT_1, () =>
        t.db.query(
          "insert into public.exercises (workspace_id, name, muscle_group, equipment, created_by) values ($1, 'Aluno cria', 'chest', 'machine', $2)",
          [wsA, STUDENT_1],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("nobody edits the global catalog through the API", async () => {
    const result = await t.asUser(TRAINER_A, () =>
      t.db.query("update public.exercises set name = 'Hacked' where id = $1", [globalExercise]),
    );
    expect(result.affectedRows).toBe(0);
    await expect(
      t.asUser(TRAINER_A, () =>
        t.db.query(
          "insert into public.exercises (workspace_id, name, muscle_group, equipment, created_by) values (null, 'Global falso', 'chest', 'machine', $1)",
          [TRAINER_A],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("other workspaces cannot see private exercises", async () => {
    const { rows } = await t.asUser(TRAINER_B, () =>
      t.db.query("select id from public.exercises where workspace_id = $1", [wsA]),
    );
    expect(rows).toHaveLength(0);
  });

  it("a plan cannot use another workspace's private exercise", async () => {
    const foreign = await one<{ id: string }>(
      TRAINER_B,
      "insert into public.exercises (workspace_id, name, muscle_group, equipment, created_by) values ($1, 'Exclusivo B', 'back', 'cable', $2) returning id",
      [wsB, TRAINER_B],
    );
    await expect(
      t.asUser(TRAINER_A, () =>
        t.db.query(
          "insert into public.session_exercises (workspace_id, session_id, exercise_id, sets, reps_min) values ($1, $2, $3, 3, 10)",
          [wsA, sessionA, foreign.id],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("workout plans", () => {
  it("a plan can only be assigned to a student of the same workspace", async () => {
    await expect(
      t.asUser(TRAINER_B, () =>
        t.db.query(
          "insert into public.workout_plans (workspace_id, student_id, name, created_by) values ($1, $2, 'Roubo', $3)",
          [wsB, STUDENT_1, TRAINER_B],
        ),
      ),
    ).rejects.toThrow(/foreign key/);
    await expect(
      t.asUser(TRAINER_B, () =>
        t.db.query(
          "insert into public.workout_plans (workspace_id, student_id, name, created_by) values ($1, $2, 'Roubo', $3)",
          [wsA, STUDENT_1, TRAINER_B],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("students see published plans, never drafts", async () => {
    const { rows } = await t.asUser(STUDENT_1, () => t.db.query<{ id: string }>("select id from public.workout_plans"));
    expect(rows.map((r) => r.id)).toEqual([planActive]);
  });

  it("students cannot see other students' plans or sessions", async () => {
    const plans = await t.asUser(STUDENT_2, () => t.db.query("select id from public.workout_plans"));
    expect(plans.rows).toHaveLength(0);
    const sessions = await t.asUser(STUDENT_2, () => t.db.query("select id from public.workout_sessions"));
    expect(sessions.rows).toHaveLength(0);
    const exercises = await t.asUser(STUDENT_2, () => t.db.query("select id from public.session_exercises"));
    expect(exercises.rows).toHaveLength(0);
  });

  it("students cannot edit their plan", async () => {
    const result = await t.asUser(STUDENT_1, () =>
      t.db.query("update public.workout_plans set name = 'Meu jeito' where id = $1", [planActive]),
    );
    expect(result.affectedRows).toBe(0);
    await expect(
      t.asUser(STUDENT_1, () =>
        t.db.query("insert into public.workout_sessions (workspace_id, plan_id, name) values ($1, $2, 'Extra')", [wsA, planActive]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("other trainers see nothing of workspace A", async () => {
    for (const table of ["workout_plans", "workout_sessions", "session_exercises", "workout_logs"]) {
      const { rows } = await t.asUser(TRAINER_B, () => t.db.query(`select 1 from public.${table}`));
      expect(rows).toHaveLength(0);
    }
  });

  it("a session cannot point at a plan of another workspace", async () => {
    await expect(
      t.asUser(TRAINER_B, () =>
        t.db.query("insert into public.workout_sessions (workspace_id, plan_id, name) values ($1, $2, 'X')", [wsB, planActive]),
      ),
    ).rejects.toThrow(/foreign key/);
  });

  it("rejects invalid prescriptions", async () => {
    await expect(
      t.asUser(TRAINER_A, () =>
        t.db.query(
          "insert into public.session_exercises (workspace_id, session_id, exercise_id, sets, reps_min, reps_max) values ($1, $2, $3, 3, 12, 8)",
          [wsA, sessionA, globalExercise],
        ),
      ),
    ).rejects.toThrow(/check constraint/);
    await expect(
      t.asUser(TRAINER_A, () =>
        t.db.query("update public.workout_sessions set weekdays = '{7}' where id = $1", [sessionA]),
      ),
    ).rejects.toThrow(/check constraint/);
  });
});

describe("workout logs", () => {
  let logId: string;

  it("the student starts and logs a workout of an active plan", async () => {
    logId = (
      await one<{ id: string }>(
        STUDENT_1,
        "insert into public.workout_logs (workspace_id, student_id, plan_id, session_id) values ($1, $2, $3, $4) returning id",
        [wsA, STUDENT_1, planActive, sessionA],
      )
    ).id;
    await t.asUser(STUDENT_1, () =>
      t.db.query(
        "insert into public.set_logs (log_id, session_exercise_id, set_number, reps, load_kg) values ($1, $2, 1, 10, 60), ($1, $2, 2, 9, 60)",
        [logId, prescribed],
      ),
    );
    const done = await t.asUser(STUDENT_1, () =>
      t.db.query("update public.workout_logs set completed_at = now() where id = $1", [logId]),
    );
    expect(done.affectedRows).toBe(1);
  });

  it("only one workout can be in progress at a time", async () => {
    const open = await one<{ id: string }>(
      STUDENT_1,
      "insert into public.workout_logs (workspace_id, student_id, plan_id, session_id) values ($1, $2, $3, $4) returning id",
      [wsA, STUDENT_1, planActive, sessionA],
    );
    await expect(
      t.asUser(STUDENT_1, () =>
        t.db.query(
          "insert into public.workout_logs (workspace_id, student_id, plan_id, session_id) values ($1, $2, $3, $4)",
          [wsA, STUDENT_1, planActive, sessionA],
        ),
      ),
    ).rejects.toThrow(/duplicate key/);
    await t.asUser(STUDENT_1, () => t.db.query("delete from public.workout_logs where id = $1", [open.id]));
  });

  it("the trainer reads the log but cannot fabricate or change activity", async () => {
    const { rows } = await t.asUser(TRAINER_A, () =>
      t.db.query<{ reps: number }>("select reps from public.set_logs where log_id = $1 order by set_number", [logId]),
    );
    expect(rows.map((r) => r.reps)).toEqual([10, 9]);

    await expect(
      t.asUser(TRAINER_A, () =>
        t.db.query(
          "insert into public.workout_logs (workspace_id, student_id, plan_id, session_id) values ($1, $2, $3, $4)",
          [wsA, STUDENT_1, planActive, sessionA],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
    const edit = await t.asUser(TRAINER_A, () =>
      t.db.query("update public.set_logs set reps = 20 where log_id = $1", [logId]),
    );
    expect(edit.affectedRows).toBe(0);
    const del = await t.asUser(TRAINER_A, () => t.db.query("delete from public.workout_logs where id = $1", [logId]));
    expect(del.affectedRows).toBe(0);
  });

  it("students cannot log on someone else's plan, a draft, or another student's log", async () => {
    await expect(
      t.asUser(STUDENT_2, () =>
        t.db.query(
          "insert into public.workout_logs (workspace_id, student_id, plan_id, session_id) values ($1, $2, $3, $4)",
          [wsA, STUDENT_2, planActive, sessionA],
        ),
      ),
    ).rejects.toThrow(/row-level security/);

    const draftSession = await one<{ id: string }>(
      TRAINER_A,
      "insert into public.workout_sessions (workspace_id, plan_id, name) values ($1, $2, 'Treino rascunho') returning id",
      [wsA, planDraft],
    );
    await expect(
      t.asUser(STUDENT_1, () =>
        t.db.query(
          "insert into public.workout_logs (workspace_id, student_id, plan_id, session_id) values ($1, $2, $3, $4)",
          [wsA, STUDENT_1, planDraft, draftSession.id],
        ),
      ),
    ).rejects.toThrow(/row-level security/);

    await expect(
      t.asUser(STUDENT_2, () =>
        t.db.query("insert into public.set_logs (log_id, session_exercise_id, set_number, reps) values ($1, $2, 3, 5)", [
          logId,
          prescribed,
        ]),
      ),
    ).rejects.toThrow(/row-level security/);
    const seen = await t.asUser(STUDENT_2, () => t.db.query("select 1 from public.workout_logs"));
    expect(seen.rows).toHaveLength(0);
  });

  it("a set must belong to the log's session", async () => {
    const otherSession = await one<{ id: string }>(
      TRAINER_A,
      "insert into public.workout_sessions (workspace_id, plan_id, name) values ($1, $2, 'Treino B') returning id",
      [wsA, planActive],
    );
    const otherPrescribed = await one<{ id: string }>(
      TRAINER_A,
      "insert into public.session_exercises (workspace_id, session_id, exercise_id, sets, reps_min) values ($1, $2, $3, 3, 10) returning id",
      [wsA, otherSession.id, globalExercise],
    );
    await expect(
      t.asUser(STUDENT_1, () =>
        t.db.query("insert into public.set_logs (log_id, session_exercise_id, set_number, reps) values ($1, $2, 1, 5)", [
          logId,
          otherPrescribed.id,
        ]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("the student cannot backdate the start of a workout", async () => {
    await expect(
      t.asUser(STUDENT_1, () =>
        t.db.query("update public.workout_logs set started_at = now() - interval '1 day' where id = $1", [logId]),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});
