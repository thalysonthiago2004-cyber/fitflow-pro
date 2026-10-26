import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type TestDb, createTestDb, uid } from "./harness";

const TRAINER_A = uid("a");
const TRAINER_B = uid("b");
const STUDENT_1 = uid("a1");
const STUDENT_2 = uid("a2");

let t: TestDb;
let wsA: string;
let plan: string;
let log: string;

async function one<T>(user: string, sql: string, params: unknown[] = []): Promise<T> {
  const { rows } = await t.asUser(user, () => t.db.query<T>(sql, params));
  return rows[0];
}

async function enroll(id: string, email: string) {
  const { rows } = await t.asUser(TRAINER_A, () =>
    t.db.query<{ token: string }>("select * from public.create_student_invitation($1, $2, 'Aluno')", [wsA, email]),
  );
  await t.createAuthUser(id, email, { invite_token: rows[0].token });
}

beforeAll(async () => {
  t = await createTestDb();
  await t.createAuthUser(TRAINER_A, "ana@example.com", { full_name: "Ana Souza" });
  await t.createAuthUser(TRAINER_B, "bruno@example.com", { full_name: "Bruno Lima" });
  wsA = await t.workspaceOf(TRAINER_A);
  await enroll(STUDENT_1, "carla@example.com");
  await enroll(STUDENT_2, "diego@example.com");

  const squat = (await t.db.query<{ id: string }>("select id from public.exercises where name = 'Agachamento livre'")).rows[0].id;
  const press = (await t.db.query<{ id: string }>("select id from public.exercises where name = 'Leg press 45°'")).rows[0].id;
  plan = (
    await one<{ id: string }>(TRAINER_A, "insert into public.workout_plans (workspace_id, student_id, name, status, created_by) values ($1, $2, 'Pernas', 'active', $3) returning id", [
      wsA,
      STUDENT_1,
      TRAINER_A,
    ])
  ).id;
  const session = (
    await one<{ id: string }>(TRAINER_A, "insert into public.workout_sessions (workspace_id, plan_id, name) values ($1, $2, 'Treino A') returning id", [wsA, plan])
  ).id;
  const group = randomUUID();
  for (const [i, exercise] of [squat, press].entries()) {
    await one(TRAINER_A, "insert into public.session_exercises (workspace_id, session_id, exercise_id, position, sets, reps_min, superset_group) values ($1, $2, $3, $4, 3, 10, $5)", [
      wsA,
      session,
      exercise,
      i,
      group,
    ]);
  }
  log = (
    await one<{ id: string }>(STUDENT_1, "insert into public.workout_logs (workspace_id, student_id, plan_id, session_id) values ($1, $2, $3, $4) returning id", [
      wsA,
      STUDENT_1,
      plan,
      session,
    ])
  ).id;
}, 60_000);

afterAll(() => t?.close());

describe("templates and duplication", () => {
  let template: string;

  it("duplicates a plan as a template with fresh superset groups", async () => {
    template = (await one<{ id: string }>(TRAINER_A, "select public.duplicate_workout_plan($1, null, 'Modelo pernas') as id", [plan])).id;
    const row = await one<{ is_template: boolean; status: string; student_id: string | null }>(TRAINER_A, "select is_template, status, student_id from public.workout_plans where id = $1", [template]);
    expect(row).toEqual({ is_template: true, status: "draft", student_id: null });
    const groups = await t.asUser(TRAINER_A, () =>
      t.db.query<{ plan_id: string; superset_group: string }>(
        "select s.plan_id, se.superset_group from public.session_exercises se join public.workout_sessions s on s.id = se.session_id where s.plan_id in ($1, $2)",
        [plan, template],
      ),
    );
    const byPlan = (id: string) => [...new Set(groups.rows.filter((r) => r.plan_id === id).map((r) => r.superset_group))];
    expect(byPlan(template)).toHaveLength(1);
    expect(byPlan(template)[0]).not.toBe(byPlan(plan)[0]);
  });

  it("creates a student's plan from the template", async () => {
    const copy = (await one<{ id: string }>(TRAINER_A, "select public.duplicate_workout_plan($1, $2, '') as id", [template, STUDENT_2])).id;
    const row = await one<{ name: string; student_id: string; is_template: boolean }>(TRAINER_A, "select name, student_id, is_template from public.workout_plans where id = $1", [copy]);
    expect(row).toEqual({ name: "Modelo pernas", student_id: STUDENT_2, is_template: false });
  });

  it("students never see templates; other trainers cannot duplicate", async () => {
    expect((await t.asUser(STUDENT_1, () => t.db.query("select 1 from public.workout_plans where is_template"))).rows).toHaveLength(0);
    await expect(t.asUser(TRAINER_B, () => t.db.query("select public.duplicate_workout_plan($1, null, 'x')", [plan]))).rejects.toThrow(/plan_not_found/);
  });

  it("a template cannot be published", async () => {
    await expect(t.asUser(TRAINER_A, () => t.db.query("update public.workout_plans set status = 'active' where id = $1", [template]))).rejects.toThrow(/check constraint/);
  });
});

describe("health questionnaires", () => {
  const INSERT = "insert into public.health_questionnaires (workspace_id, student_id, answers, needs_clearance) values ($1, $2, $3, true)";

  it("the student answers; their trainer reads; others do not", async () => {
    await t.asUser(STUDENT_1, () => t.db.query(INSERT, [wsA, STUDENT_1, JSON.stringify({ heart: true })]));
    await expect(t.asUser(STUDENT_2, () => t.db.query(INSERT, [wsA, STUDENT_1, "{}"]))).rejects.toThrow(/row-level security/);
    await expect(t.asUser(TRAINER_A, () => t.db.query(INSERT, [wsA, STUDENT_1, "{}"]))).rejects.toThrow(/row-level security/);
    for (const [user, count] of [[TRAINER_A, 1], [STUDENT_2, 0], [TRAINER_B, 0]] as const) {
      expect((await t.asUser(user, () => t.db.query("select 1 from public.health_questionnaires"))).rows).toHaveLength(count);
    }
  });
});

describe("workout comments", () => {
  const INSERT = "insert into public.workout_comments (log_id, author_id, body) values ($1, $2, $3)";

  it("the student and their trainer comment; others cannot", async () => {
    await t.asUser(STUDENT_1, () => t.db.query(INSERT, [log, STUDENT_1, "Senti o joelho."]));
    await t.asUser(TRAINER_A, () => t.db.query(INSERT, [log, TRAINER_A, "Reduza a amplitude na próxima."]));
    await expect(t.asUser(STUDENT_2, () => t.db.query(INSERT, [log, STUDENT_2, "Oi"]))).rejects.toThrow(/row-level security/);
    await expect(t.asUser(STUDENT_1, () => t.db.query(INSERT, [log, TRAINER_A, "Falso"]))).rejects.toThrow(/row-level security/);
    expect((await t.asUser(TRAINER_B, () => t.db.query("select 1 from public.workout_comments"))).rows).toHaveLength(0);
  });

  it("authors delete only their own", async () => {
    const removed = await t.asUser(STUDENT_1, () => t.db.query("delete from public.workout_comments where author_id = $1", [TRAINER_A]));
    expect(removed.affectedRows).toBe(0);
  });
});

describe("push reminders", () => {
  it("users manage only their own subscriptions", async () => {
    await t.asUser(STUDENT_1, () =>
      t.db.query("insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, 'https://push.example.com/abc', 'key', 'auth')", [STUDENT_1]),
    );
    await expect(
      t.asUser(STUDENT_2, () => t.db.query("insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, 'https://push.example.com/x', 'k', 'a')", [STUDENT_1])),
    ).rejects.toThrow(/row-level security/);
    expect((await t.asUser(TRAINER_A, () => t.db.query("select 1 from public.push_subscriptions"))).rows).toHaveLength(0);
  });

  it("claims a due water reminder exactly once, and only for the service role", async () => {
    await t.db.query("insert into public.hydration_goals (workspace_id, student_id, daily_target_ml, effective_from) values ($1, $2, 2000, '2026-01-01')", [wsA, STUDENT_1]);
    await t.db.query("insert into public.hydration_reminders (student_id, enabled, start_time, end_time, interval_minutes) values ($1, true, '08:00', '21:00', 90)", [STUDENT_1]);
    const at = "2026-10-26 13:40:00+00"; // 10:40 in São Paulo: slot 09:30
    const claim = async () => {
      await t.db.exec("set role service_role");
      try {
        return (await t.db.query<{ kind: string; endpoint: string }>("select * from public.claim_due_reminders($1)", [at])).rows;
      } finally {
        await t.db.exec("reset role");
      }
    };
    expect(await claim()).toEqual([expect.objectContaining({ kind: "water", endpoint: "https://push.example.com/abc" })]);
    expect(await claim()).toEqual([]);
    await expect(t.asUser(STUDENT_1, () => t.db.query("select * from public.claim_due_reminders($1)", [at]))).rejects.toThrow(/permission denied/);
  });
});
