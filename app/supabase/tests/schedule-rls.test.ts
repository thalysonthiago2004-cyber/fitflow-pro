import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type TestDb, createTestDb, uid } from "./harness";

const TRAINER_A = uid("a");
const TRAINER_B = uid("b");
const STUDENT_1 = uid("a1");
const STUDENT_2 = uid("a2");

let t: TestDb;
let wsA: string;
let wsB: string;

const book = (user: string, ws: string, student: string, start: string, end: string) =>
  t.asUser(user, () =>
    t.db.query<{ id: string }>(
      "insert into public.appointments (workspace_id, trainer_id, student_id, starts_at, ends_at) values ($1, $2, $3, $4, $5) returning id",
      [ws, user, student, start, end],
    ),
  );

const visible = async (user: string) =>
  (await t.asUser(user, () => t.db.query<{ id: string }>("select id from public.appointments"))).rows.map((r) => r.id);

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
  wsB = await t.workspaceOf(TRAINER_B);
  await enroll(STUDENT_1, "carla@example.com");
  await enroll(STUDENT_2, "diego@example.com");
}, 60_000);

afterAll(() => t?.close());

describe("appointments", () => {
  let first: string;

  it("lets a trainer book a session with their student", async () => {
    first = (await book(TRAINER_A, wsA, STUDENT_1, "2026-11-02T10:00:00Z", "2026-11-02T11:00:00Z")).rows[0].id;
    expect(first).toBeTruthy();
  });

  it("refuses an overlapping session for the same trainer", async () => {
    await expect(book(TRAINER_A, wsA, STUDENT_2, "2026-11-02T10:30:00Z", "2026-11-02T11:30:00Z")).rejects.toMatchObject({ code: "23P01" });
    // Back to back is fine.
    await expect(book(TRAINER_A, wsA, STUDENT_2, "2026-11-02T11:00:00Z", "2026-11-02T12:00:00Z")).resolves.toBeTruthy();
  });

  it("frees the slot once a session is cancelled", async () => {
    await t.asUser(TRAINER_A, () => t.db.query("update public.appointments set status = 'cancelled' where id = $1", [first]));
    await expect(book(TRAINER_A, wsA, STUDENT_2, "2026-11-02T10:00:00Z", "2026-11-02T10:45:00Z")).resolves.toBeTruthy();
    // Reopening the cancelled one now collides.
    await expect(t.asUser(TRAINER_A, () => t.db.query("update public.appointments set status = 'scheduled' where id = $1", [first]))).rejects.toMatchObject({ code: "23P01" });
  });

  it("rejects sessions that end before they start or last over 8 hours", async () => {
    await expect(book(TRAINER_A, wsA, STUDENT_1, "2026-11-03T10:00:00Z", "2026-11-03T09:00:00Z")).rejects.toThrow(/appointments_duration/);
    await expect(book(TRAINER_A, wsA, STUDENT_1, "2026-11-03T10:00:00Z", "2026-11-03T19:00:00Z")).rejects.toThrow(/appointments_duration/);
  });

  it("students see only their own sessions and cannot change them", async () => {
    const mine = await visible(STUDENT_1);
    expect(mine).toEqual([first]);
    expect(await visible(STUDENT_2)).toHaveLength(2);
    const { affectedRows } = await t.asUser(STUDENT_1, () => t.db.query("update public.appointments set notes = 'x' where id = $1", [first]));
    expect(affectedRows).toBe(0);
    await expect(book(STUDENT_1, wsA, STUDENT_1, "2026-11-05T10:00:00Z", "2026-11-05T11:00:00Z")).rejects.toThrow(/row-level security/);
  });

  it("other trainers cannot see, book or edit the workspace's sessions", async () => {
    expect(await visible(TRAINER_B)).toEqual([]);
    // Not a member of workspace A.
    await expect(book(TRAINER_B, wsA, STUDENT_1, "2026-11-06T10:00:00Z", "2026-11-06T11:00:00Z")).rejects.toThrow();
    // A student of another workspace cannot be booked in B.
    await expect(book(TRAINER_B, wsB, STUDENT_1, "2026-11-06T10:00:00Z", "2026-11-06T11:00:00Z")).rejects.toThrow();
    const { affectedRows } = await t.asUser(TRAINER_B, () => t.db.query("delete from public.appointments where id = $1", [first]));
    expect(affectedRows).toBe(0);
  });

  it("a trainer cannot book on behalf of someone else or move a session to another trainer", async () => {
    await expect(
      t.asUser(TRAINER_A, () =>
        t.db.query("insert into public.appointments (workspace_id, trainer_id, student_id, starts_at, ends_at) values ($1, $2, $3, now(), now() + interval '1 hour')", [
          wsA,
          TRAINER_B,
          STUDENT_1,
        ]),
      ),
    ).rejects.toThrow();
    await expect(t.asUser(TRAINER_A, () => t.db.query("update public.appointments set trainer_id = $1 where id = $2", [TRAINER_B, first]))).rejects.toThrow(/permission denied/);
  });

  it("sessions go with the student when they leave", async () => {
    await t.db.query("delete from public.students where user_id = $1", [STUDENT_2]);
    expect(await visible(TRAINER_A)).toEqual([first]);
  });
});
