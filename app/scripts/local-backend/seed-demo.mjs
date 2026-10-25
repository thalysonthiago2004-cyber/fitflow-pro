// Creates two demo accounts in the LOCAL backend so the app can be explored:
//   personal@fitflow.local / Demo2026   (trainer)
//   aluno@fitflow.local    / Demo2026   (student of that trainer)
// The trainer gets a published workout plan, meal plan and hydration goal.
// No student activity (workouts, water, measurements) is created: those are
// meant to be recorded by hand while testing. Safe to run more than once.
//
//   npm run local:seed      (with `npm run local:backend` running)
import { createHash, randomUUID } from "node:crypto";
import pg from "pg";

const PASSWORD = "Demo2026";
const TRAINER = { email: "personal@fitflow.local", name: "Personal Demo" };
const STUDENT = { email: "aluno@fitflow.local", name: "Aluno Demo" };
const DEMO_SOURCE = "Valores de exemplo (demonstração) — não usar em planos reais";

const db = new pg.Client({ host: "localhost", port: 54329, user: "postgres", password: "postgres", database: "app" });
await db.connect();
const hash = createHash("sha256").update(PASSWORD).digest("hex");

const existing = await db.query("select 1 from auth.users where email = $1", [TRAINER.email]);
if (existing.rowCount) {
  console.log("Demo accounts already exist. Use `npm run local:backend -- --reset` to start over.");
  await db.end();
  process.exit(0);
}

await db.query("begin");
try {
  const trainerId = randomUUID();
  await db.query("insert into auth.users (id, email, encrypted_password, raw_user_meta_data) values ($1, $2, $3, $4)", [
    trainerId, TRAINER.email, hash, { full_name: TRAINER.name },
  ]);
  const { rows: [ws] } = await db.query("select id from public.workspaces where owner_id = $1", [trainerId]);
  await db.query("update public.workspaces set name = 'Studio FitFlow (demonstração)' where id = $1", [ws.id]);

  // Act as the trainer so the invitation function runs its normal checks.
  const asTrainer = (sql, params) =>
    db.query("select set_config('request.jwt.claim.sub', $1, true)", [trainerId]).then(() => db.query(sql, params));

  const { rows: [invite] } = await asTrainer("select * from public.create_student_invitation($1, $2, $3)", [ws.id, STUDENT.email, STUDENT.name]);
  const studentId = randomUUID();
  await db.query("insert into auth.users (id, email, encrypted_password, raw_user_meta_data) values ($1, $2, $3, $4)", [
    studentId, STUDENT.email, hash, { full_name: STUDENT.name, invite_token: invite.token },
  ]);
  await db.query(
    "update public.students set goal = $3, experience_level = 'intermediate', height_cm = 172 where workspace_id = $1 and user_id = $2",
    [ws.id, studentId, "Ganhar massa muscular com treinos 3 a 4 vezes por semana."],
  );
  // A second, still pending invitation so the "Convites pendentes" tab has content.
  await asTrainer("select * from public.create_student_invitation($1, 'convidada@fitflow.local', 'Convidada Demo')", [ws.id]);

  // Workout plan -----------------------------------------------------------
  const exercise = async (name) => (await db.query("select id from public.exercises where workspace_id is null and name = $1", [name])).rows[0].id;
  const { rows: [plan] } = await db.query(
    "insert into public.workout_plans (workspace_id, student_id, name, notes, status, starts_on, created_by) values ($1, $2, $3, $4, 'active', current_date, $5) returning id",
    [ws.id, studentId, "Hipertrofia — fase 1 (demonstração)", "Aqueça 5 a 10 minutos antes de começar. Ajuste a carga para terminar cada série perto da falha técnica.", trainerId],
  );
  const sessions = [
    { name: "Treino A — Inferiores e peito", weekdays: [1, 3, 5], items: [
      ["Agachamento livre", 4, 8, 12, 60, 90], ["Supino reto com barra", 4, 8, 12, 40, 90], ["Leg press 45°", 3, 10, 12, 120, 90], ["Abdominal supra", 3, 15, null, null, 45],
    ] },
    { name: "Treino B — Costas e ombros", weekdays: [], items: [
      ["Puxada frontal na polia", 4, 8, 12, 45, 90], ["Remada curvada com barra", 3, 8, 10, 35, 90], ["Desenvolvimento com halteres", 3, 10, 12, 14, 60], ["Rosca direta com barra", 3, 10, 12, 20, 60],
    ] },
  ];
  for (const [position, s] of sessions.entries()) {
    const { rows: [session] } = await db.query(
      "insert into public.workout_sessions (workspace_id, plan_id, name, weekdays, position) values ($1, $2, $3, $4, $5) returning id",
      [ws.id, plan.id, s.name, s.weekdays, position],
    );
    for (const [i, [name, sets, min, max, load, rest]] of s.items.entries()) {
      await db.query(
        "insert into public.session_exercises (workspace_id, session_id, exercise_id, position, sets, reps_min, reps_max, load_kg, rest_seconds) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
        [ws.id, session.id, await exercise(name), i, sets, min, max, load, rest],
      );
    }
  }

  // Foods and meal plan ----------------------------------------------------
  const foods = {};
  for (const [name, basis, kcal, p, c, f, fiber, unitLabel, unitAmount] of [
    ["Ovo cozido (exemplo)", "g", 146, 13.3, 0.6, 9.5, 0, "unidade", 50],
    ["Pão francês (exemplo)", "g", 300, 8, 58.6, 3.1, 2.3, "unidade", 50],
    ["Arroz branco cozido (exemplo)", "g", 128, 2.5, 28.1, 0.2, 1.6, "colher de servir", 45],
    ["Feijão carioca cozido (exemplo)", "g", 76, 4.8, 13.6, 0.5, 8.5, "concha", 86],
    ["Peito de frango grelhado (exemplo)", "g", 159, 32, 0, 2.5, 0, null, null],
    ["Banana (exemplo)", "g", 98, 1.3, 26, 0.1, 2, "unidade média", 86],
    ["Leite desnatado (exemplo)", "ml", 35, 3.4, 5, 0.1, null, "copo", 200],
    ["Iogurte natural (exemplo)", "g", 51, 4.1, 1.9, 3, 0, "pote", 170],
  ]) {
    const { rows: [food] } = await db.query(
      `insert into public.foods (workspace_id, name, basis, kcal_per_100, protein_g_per_100, carbs_g_per_100, fat_g_per_100, fiber_g_per_100, unit_label, unit_amount, source, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) returning id`,
      [ws.id, name, basis, kcal, p, c, f, fiber, unitLabel, unitAmount, DEMO_SOURCE, trainerId],
    );
    foods[name.replace(" (exemplo)", "")] = food.id;
  }
  const { rows: [mealPlan] } = await db.query(
    "insert into public.meal_plans (workspace_id, student_id, name, notes, status, created_by) values ($1, $2, $3, $4, 'active', $5) returning id",
    [ws.id, studentId, "Plano alimentar (demonstração)", "Exemplo para explorar o app. Os valores dos alimentos são ilustrativos.", trainerId],
  );
  const meals = [
    ["Café da manhã", "07:00", [["Pão francês", 1, "unit"], ["Ovo cozido", 2, "unit"], ["Leite desnatado", 1, "unit"]]],
    ["Almoço", "12:30", [["Arroz branco cozido", 3, "unit"], ["Feijão carioca cozido", 1, "unit"], ["Peito de frango grelhado", 120, "g"]]],
    ["Lanche da tarde", "16:00", [["Iogurte natural", 1, "unit"], ["Banana", 1, "unit"]]],
    ["Jantar", "20:00", [["Arroz branco cozido", 2, "unit"], ["Peito de frango grelhado", 100, "g"]]],
  ];
  for (const [position, [name, time, items]] of meals.entries()) {
    const { rows: [meal] } = await db.query(
      "insert into public.meals (workspace_id, plan_id, name, time_of_day, position) values ($1, $2, $3, $4, $5) returning id",
      [ws.id, mealPlan.id, name, time, position],
    );
    for (const [i, [food, quantity, unit]] of items.entries()) {
      await db.query(
        "insert into public.meal_items (workspace_id, meal_id, food_id, quantity, unit, position) values ($1, $2, $3, $4, $5, $6)",
        [ws.id, meal.id, foods[food], quantity, unit, i],
      );
    }
  }

  await db.query(
    "insert into public.hydration_goals (workspace_id, student_id, daily_target_ml, set_by) values ($1, $2, 2500, $3)",
    [ws.id, studentId, trainerId],
  );

  await db.query("commit");
  console.log(`Demo ready:
  Personal: ${TRAINER.email} / ${PASSWORD}
  Aluno:    ${STUDENT.email} / ${PASSWORD}`);
} catch (error) {
  await db.query("rollback");
  console.error("Seed failed:", error.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
