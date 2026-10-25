import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type TestDb, createTestDb, uid } from "./harness";

const TRAINER_A = uid("a");
const TRAINER_B = uid("b");
const STUDENT_1 = uid("a1");
const STUDENT_2 = uid("a2");

let t: TestDb;
let workspaceA: string;
let workspaceB: string;

async function invite(trainer: string, workspace: string, email: string, name = "Aluno Teste") {
  const { rows } = await t.asUser(trainer, () =>
    t.db.query<{ invitation_id: string; token: string }>(
      "select * from public.create_student_invitation($1, $2, $3)",
      [workspace, email, name],
    ),
  );
  return rows[0];
}

beforeAll(async () => {
  t = await createTestDb();
  await t.createAuthUser(TRAINER_A, "ana@example.com", { full_name: "Ana Souza" });
  await t.createAuthUser(TRAINER_B, "bruno@example.com", { full_name: "Bruno Lima" });
  workspaceA = await t.workspaceOf(TRAINER_A);
  workspaceB = await t.workspaceOf(TRAINER_B);

  const first = await invite(TRAINER_A, workspaceA, "Carla@Example.com ", "Carla Dias");
  await t.createAuthUser(STUDENT_1, "carla@example.com", {
    full_name: "Carla Dias",
    invite_token: first.token,
  });
  const second = await invite(TRAINER_A, workspaceA, "diego@example.com", "Diego Alves");
  await t.createAuthUser(STUDENT_2, "diego@example.com", {
    full_name: "Diego Alves",
    invite_token: second.token,
  });
}, 60_000);

afterAll(() => t?.close());

describe("invitations", () => {
  it("stores only the token hash", async () => {
    const { rows } = await t.db.query<{ token_hash: string; email: string; status: string }>(
      "select token_hash, email, status from public.invitations where email = 'carla@example.com'",
    );
    expect(rows[0].email).toBe("carla@example.com");
    expect(rows[0].status).toBe("accepted");
    expect(rows[0].token_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("clients cannot read token_hash", async () => {
    await expect(
      t.asUser(TRAINER_A, () => t.db.query("select token_hash from public.invitations")),
    ).rejects.toThrow(/permission denied/);
  });

  it("only staff of the workspace can invite", async () => {
    await expect(invite(TRAINER_B, workspaceA, "x@example.com")).rejects.toThrow(/not_authorized/);
    await expect(invite(STUDENT_1, workspaceA, "x@example.com")).rejects.toThrow(/not_authorized/);
    await expect(
      t.asUser(null, () =>
        t.db.query("select * from public.create_student_invitation($1, 'x@example.com', 'X Y')", [
          workspaceA,
        ]),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("cannot invite someone who is already a student", async () => {
    await expect(invite(TRAINER_A, workspaceA, "carla@example.com")).rejects.toThrow(/already_student/);
  });

  it("re-inviting the same e-mail rotates the token instead of duplicating", async () => {
    const one = await invite(TRAINER_A, workspaceA, "eva@example.com", "Eva");
    const two = await invite(TRAINER_A, workspaceA, "eva@example.com", "Eva Rocha");
    expect(two.invitation_id).toBe(one.invitation_id);
    expect(two.token).not.toBe(one.token);

    const stale = await t.asUser(null, () =>
      t.db.query("select * from public.get_invitation($1)", [one.token]),
    );
    expect(stale.rows).toHaveLength(0);
    const fresh = await t.asUser(null, () =>
      t.db.query<{ full_name: string; workspace_name: string; trainer_name: string }>(
        "select * from public.get_invitation($1)",
        [two.token],
      ),
    );
    expect(fresh.rows[0]).toMatchObject({
      full_name: "Eva Rocha",
      workspace_name: "Equipe de Ana Souza",
      trainer_name: "Ana Souza",
    });
  });

  it("other trainers cannot see, refresh or revoke invitations", async () => {
    const { invitation_id } = await invite(TRAINER_A, workspaceA, "fabio@example.com");
    const seen = await t.asUser(TRAINER_B, () =>
      t.db.query("select id from public.invitations where id = $1", [invitation_id]),
    );
    expect(seen.rows).toHaveLength(0);
    await expect(
      t.asUser(TRAINER_B, () =>
        t.db.query("select public.revoke_student_invitation($1)", [invitation_id]),
      ),
    ).rejects.toThrow(/invitation_not_found/);
    await expect(
      t.asUser(TRAINER_B, () =>
        t.db.query("select * from public.refresh_student_invitation($1)", [invitation_id]),
      ),
    ).rejects.toThrow(/invitation_not_found/);
  });

  it("revoked and expired invitations cannot be used", async () => {
    const revoked = await invite(TRAINER_A, workspaceA, "gil@example.com");
    await t.asUser(TRAINER_A, () =>
      t.db.query("select public.revoke_student_invitation($1)", [revoked.invitation_id]),
    );
    await expect(
      t.createAuthUser(uid("e1"), "gil@example.com", { invite_token: revoked.token }),
    ).rejects.toThrow(/invitation_invalid/);

    const expired = await invite(TRAINER_A, workspaceA, "hugo@example.com");
    await t.db.query("update public.invitations set expires_at = now() - interval '1 minute' where id = $1", [
      expired.invitation_id,
    ]);
    await expect(
      t.createAuthUser(uid("e2"), "hugo@example.com", { invite_token: expired.token }),
    ).rejects.toThrow(/invitation_invalid/);
  });

  it("sign-up with a token for a different e-mail is rejected", async () => {
    const { token } = await invite(TRAINER_A, workspaceA, "ines@example.com");
    await expect(
      t.createAuthUser(uid("e3"), "intruso@example.com", { invite_token: token }),
    ).rejects.toThrow(/invitation_email_mismatch/);
    // The failed sign-up leaves nothing behind.
    const { rows } = await t.db.query("select 1 from public.profiles where id = $1", [uid("e3")]);
    expect(rows).toHaveLength(0);
  });
});

describe("enrollment", () => {
  it("invite sign-up creates a student profile, membership and student row", async () => {
    const profile = await t.db.query<{ role: string }>("select role from public.profiles where id = $1", [
      STUDENT_1,
    ]);
    expect(profile.rows[0].role).toBe("student");

    const membership = await t.db.query<{ workspace_id: string; role: string }>(
      "select workspace_id, role from public.workspace_members where user_id = $1",
      [STUDENT_1],
    );
    expect(membership.rows).toEqual([{ workspace_id: workspaceA, role: "student" }]);

    const ownWorkspaces = await t.db.query("select 1 from public.workspaces where owner_id = $1", [STUDENT_1]);
    expect(ownWorkspaces.rows).toHaveLength(0);
  });

  it("an enrolled student cannot accept a second invitation", async () => {
    const { token } = await invite(TRAINER_B, workspaceB, "carla@example.com");
    await expect(
      t.asUser(STUDENT_1, () => t.db.query("select public.accept_invitation($1)", [token])),
    ).rejects.toThrow(/already_enrolled/);
  });

  it("trainer accounts cannot accept invitations", async () => {
    const { token } = await invite(TRAINER_B, workspaceB, "ana@example.com");
    await expect(
      t.asUser(TRAINER_A, () => t.db.query("select public.accept_invitation($1)", [token])),
    ).rejects.toThrow(/trainer_account/);
  });

  it("a removed student can join another trainer", async () => {
    const studentId = uid("a3");
    const first = await invite(TRAINER_A, workspaceA, "joao@example.com", "João Reis");
    await t.createAuthUser(studentId, "joao@example.com", { invite_token: first.token });

    await expect(
      t.asUser(TRAINER_B, () => t.db.query("select public.remove_student($1, $2)", [workspaceA, studentId])),
    ).rejects.toThrow(/not_authorized/);
    await t.asUser(TRAINER_A, () =>
      t.db.query("select public.remove_student($1, $2)", [workspaceA, studentId]),
    );

    const second = await invite(TRAINER_B, workspaceB, "joao@example.com", "João Reis");
    const { rows } = await t.asUser(studentId, () =>
      t.db.query<{ accept_invitation: string }>("select public.accept_invitation($1)", [second.token]),
    );
    expect(rows[0].accept_invitation).toBe(workspaceB);

    // The student data from trainer A is gone with the membership.
    const leftovers = await t.db.query("select 1 from public.students where workspace_id = $1 and user_id = $2", [
      workspaceA,
      studentId,
    ]);
    expect(leftovers.rows).toHaveLength(0);
  });

  it("a token works only once", async () => {
    const { token } = await invite(TRAINER_A, workspaceA, "kaio@example.com");
    await t.createAuthUser(uid("a4"), "kaio@example.com", { invite_token: token });
    const { rows } = await t.asUser(null, () => t.db.query("select * from public.get_invitation($1)", [token]));
    expect(rows).toHaveLength(0);
  });
});

describe("students table", () => {
  it("trainer sees their students; other trainers see none", async () => {
    const mine = await t.asUser(TRAINER_A, () =>
      t.db.query<{ user_id: string }>("select user_id from public.students where user_id = any($1)", [
        [STUDENT_1, STUDENT_2],
      ]),
    );
    expect(mine.rows).toHaveLength(2);
    const theirs = await t.asUser(TRAINER_B, () =>
      t.db.query("select user_id from public.students where workspace_id = $1", [workspaceA]),
    );
    expect(theirs.rows).toHaveLength(0);
  });

  it("student sees only their own row", async () => {
    const { rows } = await t.asUser(STUDENT_1, () =>
      t.db.query<{ user_id: string }>("select user_id from public.students"),
    );
    expect(rows.map((r) => r.user_id)).toEqual([STUDENT_1]);
  });

  it("trainer updates profile fields; student and other trainers cannot", async () => {
    const ok = await t.asUser(TRAINER_A, () =>
      t.db.query(
        "update public.students set goal = 'Hipertrofia', height_cm = 172.5, experience_level = 'beginner' where user_id = $1",
        [STUDENT_1],
      ),
    );
    expect(ok.affectedRows).toBe(1);

    for (const user of [STUDENT_1, TRAINER_B]) {
      const denied = await t.asUser(user, () =>
        t.db.query("update public.students set goal = 'Hacked' where user_id = $1", [STUDENT_1]),
      );
      expect(denied.affectedRows).toBe(0);
    }
  });

  it("nobody can move a student to another workspace or change e-mail directly", async () => {
    await expect(
      t.asUser(TRAINER_A, () =>
        t.db.query("update public.students set workspace_id = $1 where user_id = $2", [workspaceB, STUDENT_1]),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      t.asUser(TRAINER_A, () =>
        t.db.query("update public.students set email = 'x@y.z' where user_id = $1", [STUDENT_1]),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("rejects out-of-range measurements", async () => {
    await expect(
      t.db.query("update public.students set height_cm = 400 where user_id = $1", [STUDENT_1]),
    ).rejects.toThrow(/check constraint/);
  });

  it("students still cannot see other students' profiles", async () => {
    const { rows } = await t.asUser(STUDENT_1, () =>
      t.db.query<{ id: string }>("select id from public.profiles"),
    );
    expect(rows.map((r) => r.id).sort()).toEqual([TRAINER_A, STUDENT_1].sort());
  });
});
