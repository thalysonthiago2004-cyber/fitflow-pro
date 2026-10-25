import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type TestDb, createTestDb, uid } from "./harness";

const TRAINER_A = uid("a");
const TRAINER_B = uid("b");
const STUDENT_1 = uid("a1");
const STUDENT_2 = uid("a2");

let t: TestDb;
let wsA: string;

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
  await enroll(STUDENT_1, "carla@example.com");
  await enroll(STUDENT_2, "diego@example.com");
}, 60_000);

afterAll(() => t?.close());

describe("hydration goals", () => {
  it("staff set a goal; the student reads it", async () => {
    await t.asUser(TRAINER_A, () =>
      t.db.query(
        "insert into public.hydration_goals (workspace_id, student_id, daily_target_ml, set_by) values ($1, $2, 2500, $3)",
        [wsA, STUDENT_1, TRAINER_A],
      ),
    );
    const { rows } = await t.asUser(STUDENT_1, () =>
      t.db.query<{ daily_target_ml: number }>("select daily_target_ml from public.hydration_goals"),
    );
    expect(rows.map((r) => r.daily_target_ml)).toEqual([2500]);
  });

  it("students, other students and other trainers cannot set or see goals", async () => {
    for (const [user, ws] of [[STUDENT_1, wsA], [TRAINER_B, wsA]] as const) {
      await expect(
        t.asUser(user, () =>
          t.db.query(
            "insert into public.hydration_goals (workspace_id, student_id, daily_target_ml, set_by) values ($1, $2, 9000, $3)",
            [ws, STUDENT_1, user],
          ),
        ),
      ).rejects.toThrow(/row-level security/);
    }
    for (const user of [STUDENT_2, TRAINER_B]) {
      const { rows } = await t.asUser(user, () => t.db.query("select 1 from public.hydration_goals"));
      expect(rows).toHaveLength(0);
    }
  });

  it("rejects implausible targets", async () => {
    await expect(
      t.asUser(TRAINER_A, () =>
        t.db.query(
          "insert into public.hydration_goals (workspace_id, student_id, daily_target_ml, set_by) values ($1, $2, 50000, $3)",
          [wsA, STUDENT_1, TRAINER_A],
        ),
      ),
    ).rejects.toThrow(/check constraint/);
  });
});

describe("water logs", () => {
  it("the student logs water; the database sets time and day", async () => {
    const { rows } = await t.asUser(STUDENT_1, () =>
      t.db.query<{ local_date: string; logged_at: string }>(
        "insert into public.water_logs (workspace_id, student_id, amount_ml) values ($1, $2, 300) returning local_date::text, logged_at",
        [wsA, STUDENT_1],
      ),
    );
    const expected = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    expect(rows[0].local_date).toBe(expected);
  });

  it("clients cannot backdate entries", async () => {
    await expect(
      t.asUser(STUDENT_1, () =>
        t.db.query(
          "insert into public.water_logs (workspace_id, student_id, amount_ml, logged_at) values ($1, $2, 300, now() - interval '3 days')",
          [wsA, STUDENT_1],
        ),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("nobody logs for someone else, trainers included", async () => {
    for (const user of [TRAINER_A, STUDENT_2]) {
      await expect(
        t.asUser(user, () =>
          t.db.query("insert into public.water_logs (workspace_id, student_id, amount_ml) values ($1, $2, 300)", [wsA, STUDENT_1]),
        ),
      ).rejects.toThrow(/row-level security/);
    }
  });

  it("the trainer reads; other students and trainers do not", async () => {
    const trainer = await t.asUser(TRAINER_A, () => t.db.query("select 1 from public.water_logs where student_id = $1", [STUDENT_1]));
    expect(trainer.rows.length).toBeGreaterThan(0);
    for (const user of [STUDENT_2, TRAINER_B]) {
      const { rows } = await t.asUser(user, () => t.db.query("select 1 from public.water_logs"));
      expect(rows).toHaveLength(0);
    }
  });

  it("only today's own entries can be removed", async () => {
    const { rows } = await t.db.query<{ id: string }>(
      "insert into public.water_logs (workspace_id, student_id, amount_ml) values ($1, $2, 200) returning id",
      [wsA, STUDENT_1],
    );
    await t.db.query("update public.water_logs set local_date = local_date - 1 where id = $1", [rows[0].id]);
    const old = await t.asUser(STUDENT_1, () => t.db.query("delete from public.water_logs where id = $1", [rows[0].id]));
    expect(old.affectedRows).toBe(0);

    const trainerDelete = await t.asUser(TRAINER_A, () => t.db.query("delete from public.water_logs where student_id = $1", [STUDENT_1]));
    expect(trainerDelete.affectedRows).toBe(0);

    const today = await t.asUser(STUDENT_1, () =>
      t.db.query("delete from public.water_logs where student_id = $1 and local_date = (now() at time zone 'America/Sao_Paulo')::date", [STUDENT_1]),
    );
    expect(today.affectedRows).toBeGreaterThan(0);
  });

  it("rejects implausible amounts", async () => {
    await expect(
      t.asUser(STUDENT_1, () =>
        t.db.query("insert into public.water_logs (workspace_id, student_id, amount_ml) values ($1, $2, 9000)", [wsA, STUDENT_1]),
      ),
    ).rejects.toThrow(/check constraint/);
  });
});

describe("reminder preferences", () => {
  it("the student manages their own preferences only", async () => {
    await t.asUser(STUDENT_1, () =>
      t.db.query("insert into public.hydration_reminders (student_id, enabled, interval_minutes) values ($1, true, 60)", [STUDENT_1]),
    );
    await expect(
      t.asUser(STUDENT_2, () =>
        t.db.query("insert into public.hydration_reminders (student_id, enabled) values ($1, true)", [STUDENT_1]),
      ),
    ).rejects.toThrow(/row-level security/);
    const seen = await t.asUser(TRAINER_A, () => t.db.query("select 1 from public.hydration_reminders"));
    expect(seen.rows).toHaveLength(0);
  });
});
