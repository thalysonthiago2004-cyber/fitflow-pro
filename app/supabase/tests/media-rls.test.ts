import { randomUUID } from "node:crypto";
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

const putObject = (bucket: string, name: string) =>
  t.db.query("insert into storage.objects (bucket_id, name) values ($1, $2)", [bucket, name]);

beforeAll(async () => {
  t = await createTestDb();
  await t.createAuthUser(TRAINER_A, "ana@example.com", { full_name: "Ana Souza" });
  await t.createAuthUser(TRAINER_B, "bruno@example.com", { full_name: "Bruno Lima" });
  wsA = await t.workspaceOf(TRAINER_A);
  await enroll(STUDENT_1, "carla@example.com");
  await enroll(STUDENT_2, "diego@example.com");
}, 60_000);

afterAll(() => t?.close());

describe("avatars", () => {
  it("users upload only into their own folder", async () => {
    await t.asUser(TRAINER_A, () => putObject("avatars", `${TRAINER_A}/avatar-1.webp`));
    await expect(t.asUser(TRAINER_B, () => putObject("avatars", `${TRAINER_A}/avatar-2.webp`))).rejects.toThrow(/row-level security/);
  });

  it("the profile points only at the owner's folder", async () => {
    const own = await t.asUser(TRAINER_A, () =>
      t.db.query("update public.profiles set avatar_path = $1 where id = $2", [`${TRAINER_A}/avatar-1.webp`, TRAINER_A]),
    );
    expect(own.affectedRows).toBe(1);
    await expect(
      t.asUser(TRAINER_B, () => t.db.query("update public.profiles set avatar_path = $1 where id = $2", [`${TRAINER_A}/avatar-1.webp`, TRAINER_B])),
    ).rejects.toThrow(/check constraint/);
    const other = await t.asUser(TRAINER_B, () =>
      t.db.query("update public.profiles set avatar_path = null where id = $1", [TRAINER_A]),
    );
    expect(other.affectedRows).toBe(0);
  });

  it("students see their trainer's photo path", async () => {
    const { rows } = await t.asUser(STUDENT_1, () =>
      t.db.query<{ avatar_path: string }>("select avatar_path from public.profiles where id = $1", [TRAINER_A]),
    );
    expect(rows[0].avatar_path).toBe(`${TRAINER_A}/avatar-1.webp`);
  });
});

describe("progress photos", () => {
  const INSERT = `insert into public.progress_photos (workspace_id, student_id, taken_on, pose, storage_path)
    values ($1, $2, $3, 'front', $4) returning id`;
  const path = (student: string) => `${wsA}/${student}/${randomUUID()}.jpg`;
  let photoPath: string;

  it("the student uploads into their own folder", async () => {
    photoPath = path(STUDENT_1);
    await t.asUser(STUDENT_1, () => putObject("progress-photos", photoPath));
    await t.asUser(STUDENT_1, () => t.db.query(INSERT, [wsA, STUDENT_1, "2026-10-01", photoPath]));
  });

  it("nobody uploads into another student's folder, not even the trainer", async () => {
    await expect(t.asUser(STUDENT_2, () => putObject("progress-photos", path(STUDENT_1)))).rejects.toThrow(/row-level security/);
    await expect(t.asUser(TRAINER_A, () => putObject("progress-photos", path(STUDENT_1)))).rejects.toThrow(/row-level security/);
    await expect(t.asUser(STUDENT_1, () => putObject("progress-photos", "not/a-valid/path.jpg"))).rejects.toThrow(/row-level security/);
    await expect(t.asUser(STUDENT_2, () => t.db.query(INSERT, [wsA, STUDENT_1, "2026-10-01", path(STUDENT_1)]))).rejects.toThrow(/row-level security/);
  });

  it("the row must point at the student's folder", async () => {
    await expect(t.asUser(STUDENT_1, () => t.db.query(INSERT, [wsA, STUDENT_1, "2026-10-01", path(STUDENT_2)]))).rejects.toThrow(/check constraint/);
  });

  it("the student and their trainer read; others do not", async () => {
    for (const user of [STUDENT_1, TRAINER_A]) {
      const rows = await t.asUser(user, () => t.db.query("select 1 from public.progress_photos"));
      const files = await t.asUser(user, () => t.db.query("select 1 from storage.objects where bucket_id = 'progress-photos'"));
      expect(rows.rows).toHaveLength(1);
      expect(files.rows).toHaveLength(1);
    }
    for (const user of [STUDENT_2, TRAINER_B]) {
      const rows = await t.asUser(user, () => t.db.query("select 1 from public.progress_photos"));
      const files = await t.asUser(user, () => t.db.query("select 1 from storage.objects where bucket_id = 'progress-photos'"));
      expect(rows.rows).toHaveLength(0);
      expect(files.rows).toHaveLength(0);
    }
  });

  it("rejects future dates", async () => {
    const future = path(STUDENT_1);
    await expect(t.asUser(STUDENT_1, () => t.db.query(INSERT, [wsA, STUDENT_1, "2099-01-01", future]))).rejects.toThrow(/future_date/);
  });

  it("only the student deletes", async () => {
    const byTrainer = await t.asUser(TRAINER_A, () => t.db.query("delete from public.progress_photos"));
    const fileByTrainer = await t.asUser(TRAINER_A, () => t.db.query("delete from storage.objects where bucket_id = 'progress-photos'"));
    expect(byTrainer.affectedRows).toBe(0);
    expect(fileByTrainer.affectedRows).toBe(0);
    const own = await t.asUser(STUDENT_1, () => t.db.query("delete from public.progress_photos"));
    const ownFile = await t.asUser(STUDENT_1, () => t.db.query("delete from storage.objects where name = $1", [photoPath]));
    expect(own.affectedRows).toBe(1);
    expect(ownFile.affectedRows).toBe(1);
  });
});

describe("body composition", () => {
  it("staff record the student's sex; the student cannot", async () => {
    const byTrainer = await t.asUser(TRAINER_A, () => t.db.query("update public.students set sex = 'female' where user_id = $1", [STUDENT_1]));
    expect(byTrainer.affectedRows).toBe(1);
    const byStudent = await t.asUser(STUDENT_1, () => t.db.query("update public.students set sex = 'male' where user_id = $1", [STUDENT_1]));
    expect(byStudent.affectedRows).toBe(0);
  });

  it("bioimpedance values count as a measurement and are range-checked", async () => {
    const insert = `insert into public.body_measurements (workspace_id, student_id, measured_on, muscle_mass_kg, visceral_fat, source, recorded_by)
      values ($1, $2, '2026-10-01', $3, $4, 'bioimpedance', $2)`;
    await t.asUser(STUDENT_1, () => t.db.query(insert, [wsA, STUDENT_1, 30.5, 6]));
    await expect(t.asUser(STUDENT_1, () => t.db.query(insert, [wsA, STUDENT_1, 30.5, 90]))).rejects.toThrow(/check constraint/);
  });
});
