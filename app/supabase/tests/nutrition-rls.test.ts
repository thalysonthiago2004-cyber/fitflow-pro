import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type TestDb, createTestDb, uid } from "./harness";

const TRAINER_A = uid("a");
const TRAINER_B = uid("b");
const STUDENT_1 = uid("a1");
const STUDENT_2 = uid("a2");

let t: TestDb;
let wsA: string;
let wsB: string;
let rice: string;
let egg: string;
let milk: string;
let unusedFood: string;
let activePlan: string;
let draftPlan: string;
let breakfast: string;

async function enroll(id: string, email: string) {
  const { rows } = await t.asUser(TRAINER_A, () =>
    t.db.query<{ token: string }>("select * from public.create_student_invitation($1, $2, 'Aluno X')", [wsA, email]),
  );
  await t.createAuthUser(id, email, { invite_token: rows[0].token });
}

async function one<T>(user: string, sql: string, params: unknown[] = []) {
  const { rows } = await t.asUser(user, () => t.db.query<T>(sql, params));
  return rows[0];
}

const FOOD_SQL = `insert into public.foods (workspace_id, name, basis, kcal_per_100, protein_g_per_100, carbs_g_per_100, fat_g_per_100, unit_label, unit_amount, source, created_by)
  values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Rótulo do produto', $10) returning id`;

beforeAll(async () => {
  t = await createTestDb();
  await t.createAuthUser(TRAINER_A, "ana@example.com", { full_name: "Ana Souza" });
  await t.createAuthUser(TRAINER_B, "bruno@example.com", { full_name: "Bruno Lima" });
  wsA = await t.workspaceOf(TRAINER_A);
  wsB = await t.workspaceOf(TRAINER_B);
  await enroll(STUDENT_1, "carla@example.com");
  await enroll(STUDENT_2, "diego@example.com");

  rice = (await one<{ id: string }>(TRAINER_A, FOOD_SQL, [wsA, "Arroz cozido", "g", 128, 2.5, 28, 0.2, null, null, TRAINER_A])).id;
  egg = (await one<{ id: string }>(TRAINER_A, FOOD_SQL, [wsA, "Ovo cozido", "g", 146, 13.3, 0.6, 9.5, "unidade", 50, TRAINER_A])).id;
  milk = (await one<{ id: string }>(TRAINER_A, FOOD_SQL, [wsA, "Leite desnatado", "ml", 35, 3.4, 5, 0.1, null, null, TRAINER_A])).id;
  unusedFood = (await one<{ id: string }>(TRAINER_A, FOOD_SQL, [wsA, "Aveia", "g", 394, 13.9, 66.6, 8.5, null, null, TRAINER_A])).id;

  activePlan = (
    await one<{ id: string }>(TRAINER_A, "insert into public.meal_plans (workspace_id, student_id, name, status, created_by) values ($1, $2, 'Plano', 'active', $3) returning id", [wsA, STUDENT_1, TRAINER_A])
  ).id;
  draftPlan = (
    await one<{ id: string }>(TRAINER_A, "insert into public.meal_plans (workspace_id, student_id, name, created_by) values ($1, $2, 'Rascunho', $3) returning id", [wsA, STUDENT_1, TRAINER_A])
  ).id;
  breakfast = (
    await one<{ id: string }>(TRAINER_A, "insert into public.meals (workspace_id, plan_id, name, time_of_day) values ($1, $2, 'Café da manhã', '07:30') returning id", [wsA, activePlan])
  ).id;
  await t.asUser(TRAINER_A, () =>
    t.db.query(
      "insert into public.meal_items (workspace_id, meal_id, food_id, quantity, unit) values ($1, $2, $3, 2, 'unit'), ($1, $2, $4, 200, 'ml'), ($1, $2, $5, 100, 'g')",
      [wsA, breakfast, egg, milk, rice],
    ),
  );
}, 60_000);

afterAll(() => t?.close());

describe("foods", () => {
  it("requires a source and coherent values", async () => {
    await expect(
      t.asUser(TRAINER_A, () =>
        t.db.query(
          "insert into public.foods (workspace_id, name, kcal_per_100, protein_g_per_100, carbs_g_per_100, fat_g_per_100, source, created_by) values ($1, 'Sem fonte', 100, 1, 1, 1, ' ', $2)",
          [wsA, TRAINER_A],
        ),
      ),
    ).rejects.toThrow(/check constraint/);
    await expect(
      t.asUser(TRAINER_A, () =>
        t.db.query(
          "insert into public.foods (workspace_id, name, kcal_per_100, protein_g_per_100, carbs_g_per_100, fat_g_per_100, source, created_by) values ($1, 'Impossível', 100, 60, 60, 1, 'X Y', $2)",
          [wsA, TRAINER_A],
        ),
      ),
    ).rejects.toThrow(/check constraint/);
    await expect(
      t.asUser(TRAINER_A, () =>
        t.db.query(
          "insert into public.foods (workspace_id, name, kcal_per_100, protein_g_per_100, carbs_g_per_100, fat_g_per_100, unit_label, source, created_by) values ($1, 'Meia medida', 100, 1, 1, 1, 'fatia', 'X Y', $2)",
          [wsA, TRAINER_A],
        ),
      ),
    ).rejects.toThrow(/check constraint/);
  });

  it("other trainers cannot see or use workspace A foods", async () => {
    const { rows } = await t.asUser(TRAINER_B, () => t.db.query("select 1 from public.foods"));
    expect(rows).toHaveLength(0);

    const planB = await t.asUser(TRAINER_B, async () => {
      const { rows: inv } = await t.db.query<{ token: string }>("select * from public.create_student_invitation($1, 'eva@example.com', 'Eva')", [wsB]);
      return inv[0].token;
    });
    await t.createAuthUser(uid("b1"), "eva@example.com", { invite_token: planB });
    const plan = await one<{ id: string }>(TRAINER_B, "insert into public.meal_plans (workspace_id, student_id, name, created_by) values ($1, $2, 'Plano B', $3) returning id", [wsB, uid("b1"), TRAINER_B]);
    const meal = await one<{ id: string }>(TRAINER_B, "insert into public.meals (workspace_id, plan_id, name) values ($1, $2, 'Almoço') returning id", [wsB, plan.id]);
    await expect(
      t.asUser(TRAINER_B, () =>
        t.db.query("insert into public.meal_items (workspace_id, meal_id, food_id, quantity, unit) values ($1, $2, $3, 100, 'g')", [wsB, meal.id, rice]),
      ),
    ).rejects.toThrow(/foreign key/);
  });

  it("students see only the foods used in their published plans", async () => {
    const mine = await t.asUser(STUDENT_1, () => t.db.query<{ id: string }>("select id from public.foods"));
    expect(mine.rows.map((r) => r.id).sort()).toEqual([rice, egg, milk].sort());
    expect(mine.rows.map((r) => r.id)).not.toContain(unusedFood);
    const other = await t.asUser(STUDENT_2, () => t.db.query("select 1 from public.foods"));
    expect(other.rows).toHaveLength(0);
  });

  it("students cannot create or edit foods", async () => {
    await expect(
      t.asUser(STUDENT_1, () =>
        t.db.query(
          "insert into public.foods (workspace_id, name, kcal_per_100, protein_g_per_100, carbs_g_per_100, fat_g_per_100, source, created_by) values ($1, 'Doce', 400, 1, 1, 1, 'X Y', $2)",
          [wsA, STUDENT_1],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
    const edit = await t.asUser(STUDENT_1, () => t.db.query("update public.foods set kcal_per_100 = 1 where id = $1", [rice]));
    expect(edit.affectedRows).toBe(0);
  });
});

describe("meal items", () => {
  it("units must match the food", async () => {
    await expect(
      t.asUser(TRAINER_A, () =>
        t.db.query("insert into public.meal_items (workspace_id, meal_id, food_id, quantity, unit) values ($1, $2, $3, 1, 'unit')", [wsA, breakfast, rice]),
      ),
    ).rejects.toThrow(/unit_not_available/);
    await expect(
      t.asUser(TRAINER_A, () =>
        t.db.query("insert into public.meal_items (workspace_id, meal_id, food_id, quantity, unit) values ($1, $2, $3, 100, 'ml')", [wsA, breakfast, rice]),
      ),
    ).rejects.toThrow(/unit_mismatch/);
  });
});

describe("meal plans", () => {
  it("students see published plans only, and only their own", async () => {
    const mine = await t.asUser(STUDENT_1, () => t.db.query<{ id: string }>("select id from public.meal_plans"));
    expect(mine.rows.map((r) => r.id)).toEqual([activePlan]);
    expect(mine.rows.map((r) => r.id)).not.toContain(draftPlan);
    for (const table of ["meal_plans", "meals", "meal_items"]) {
      const { rows } = await t.asUser(STUDENT_2, () => t.db.query(`select 1 from public.${table}`));
      expect(rows).toHaveLength(0);
    }
    const items = await t.asUser(STUDENT_1, () => t.db.query("select 1 from public.meal_items"));
    expect(items.rows).toHaveLength(3);
  });

  it("students cannot change their plan", async () => {
    const result = await t.asUser(STUDENT_1, () => t.db.query("update public.meal_items set quantity = 999 where meal_id = $1", [breakfast]));
    expect(result.affectedRows).toBe(0);
    await expect(
      t.asUser(STUDENT_1, () =>
        t.db.query("insert into public.meals (workspace_id, plan_id, name) values ($1, $2, 'Lanche extra')", [wsA, activePlan]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("plans can only target students of the same workspace", async () => {
    await expect(
      t.asUser(TRAINER_B, () =>
        t.db.query("insert into public.meal_plans (workspace_id, student_id, name, created_by) values ($1, $2, 'Plano X', $3)", [wsB, STUDENT_1, TRAINER_B]),
      ),
    ).rejects.toThrow(/foreign key/);
  });

  it("foods in use cannot be deleted out from under a plan", async () => {
    await expect(t.db.query("delete from public.foods where id = $1", [egg])).rejects.toThrow(/foreign key/);
  });
});
