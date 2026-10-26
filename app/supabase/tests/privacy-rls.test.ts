import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type TestDb, createTestDb, uid } from "./harness";

const TRAINER_A = uid("a");
const TRAINER_B = uid("b");
const STUDENT_1 = uid("a1");
const STUDENT_2 = uid("a2");

let t: TestDb;
let wsA: string;

async function invite(email: string) {
  const { rows } = await t.asUser(TRAINER_A, () =>
    t.db.query<{ token: string }>("select * from public.create_student_invitation($1, $2, 'Aluno')", [wsA, email]),
  );
  return rows[0].token;
}

beforeAll(async () => {
  t = await createTestDb();
  await t.createAuthUser(TRAINER_A, "ana@example.com", { full_name: "Ana Souza", consent_version: "2026-10-25" });
  wsA = await t.workspaceOf(TRAINER_A);
  await t.createAuthUser(STUDENT_1, "carla@example.com", { invite_token: await invite("carla@example.com"), consent_version: "2026-10-25" });
}, 60_000);

afterAll(() => t?.close());

describe("closed beta", () => {
  it("trainer sign-ups need the beta code once one is configured", async () => {
    await t.db.query("insert into private.settings (key, value) values ('beta_code_sha256', private.hash_token('FITFLOW2026'))");
    await expect(t.createAuthUser(TRAINER_B, "bruno@example.com", { full_name: "Bruno" })).rejects.toThrow(/beta_code_invalid/);
    await expect(t.createAuthUser(TRAINER_B, "bruno@example.com", { full_name: "Bruno", beta_code: "errado" })).rejects.toThrow(/beta_code_invalid/);
    await t.createAuthUser(TRAINER_B, "bruno@example.com", { full_name: "Bruno", beta_code: " fitflow2026 " });
  });

  it("invited students do not need the code", async () => {
    await t.createAuthUser(STUDENT_2, "diego@example.com", { invite_token: await invite("diego@example.com") });
    const { rows } = await t.db.query<{ role: string }>("select role from public.profiles where id = $1", [STUDENT_2]);
    expect(rows[0].role).toBe("student");
  });
});

describe("consents", () => {
  it("records the documents accepted at sign-up, health data for students", async () => {
    const docs = async (user: string) =>
      (await t.asUser(user, () => t.db.query<{ document: string }>("select document from public.consents order by document"))).rows.map((r) => r.document);
    expect(await docs(TRAINER_A)).toEqual(["privacy", "terms"]);
    expect(await docs(STUDENT_1)).toEqual(["health_data", "privacy", "terms"]);
  });

  it("users only see and record their own", async () => {
    const { rows } = await t.asUser(TRAINER_A, () => t.db.query("select 1 from public.consents where user_id = $1", [STUDENT_1]));
    expect(rows).toHaveLength(0);
    await expect(
      t.asUser(TRAINER_A, () => t.db.query("insert into public.consents (user_id, document, version) values ($1, 'terms', '2027-01-01')", [STUDENT_1])),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("students edit their body data", () => {
  it("updates only the caller's own record and checks ranges", async () => {
    await t.asUser(STUDENT_1, () => t.db.query("select public.update_my_body_profile('female', 165.24, '1996-03-10')"));
    const { rows } = await t.db.query<{ sex: string; height_cm: string }>("select sex, height_cm from public.students where user_id = $1", [STUDENT_1]);
    expect(rows[0]).toMatchObject({ sex: "female", height_cm: "165.2" });
    await expect(t.asUser(STUDENT_1, () => t.db.query("select public.update_my_body_profile('female', 20, null)"))).rejects.toThrow(/height_out_of_range/);
    await expect(t.asUser(null, () => t.db.query("select public.update_my_body_profile('male', 170, null)"))).rejects.toThrow(/permission denied/);
  });
});

describe("account deletion", () => {
  it("a student's account and data go away; the trainer stays", async () => {
    await t.asUser(STUDENT_2, () => t.db.query("select public.delete_my_account()"));
    expect((await t.db.query("select 1 from public.profiles where id = $1", [STUDENT_2])).rows).toHaveLength(0);
    expect((await t.db.query("select 1 from public.students where user_id = $1", [STUDENT_2])).rows).toHaveLength(0);
    expect((await t.db.query("select 1 from public.profiles where id = $1", [TRAINER_A])).rows).toHaveLength(1);
  });

  it("a trainer's workspace goes with them; their students keep their accounts", async () => {
    await t.asUser(TRAINER_A, () => t.db.query("select public.delete_my_account()"));
    expect((await t.db.query("select 1 from public.workspaces where id = $1", [wsA])).rows).toHaveLength(0);
    expect((await t.db.query("select 1 from public.profiles where id = $1", [STUDENT_1])).rows).toHaveLength(1);
  });

  it("guests cannot call it", async () => {
    await expect(t.asUser(null, () => t.db.query("select public.delete_my_account()"))).rejects.toThrow(/permission denied/);
  });
});
