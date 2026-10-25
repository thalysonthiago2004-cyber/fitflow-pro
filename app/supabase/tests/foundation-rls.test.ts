import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SUPABASE_STUB } from "./harness";

// Runs the real migrations against an in-process Postgres (PGlite) with a
// minimal stand-in for the Supabase auth and storage schemas and API roles. This verifies
// policies and grants; it does not replace testing against a Supabase project.

const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

const TRAINER_A = "00000000-0000-4000-8000-00000000000a";
const TRAINER_B = "00000000-0000-4000-8000-00000000000b";
const STUDENT_A1 = "00000000-0000-4000-8000-0000000000a1";
const STUDENT_A2 = "00000000-0000-4000-8000-0000000000a2";

let db: PGlite;

async function asUser<T>(userId: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(userId ? "set role authenticated" : "set role anon");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? ""]);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}

async function createAuthUser(id: string, email: string, fullName?: string) {
  await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [
    id,
    email,
    JSON.stringify(fullName ? { full_name: fullName } : {}),
  ]);
}

async function workspaceOf(ownerId: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    "select id from public.workspaces where owner_id = $1",
    [ownerId],
  );
  return rows[0].id;
}

// Simulates what the Phase 2 invitation flow will do with elevated privileges.
async function enrollStudent(studentId: string, trainerId: string) {
  const workspaceId = await workspaceOf(studentId);
  await db.query("delete from public.workspaces where id = $1", [workspaceId]);
  await db.query("update public.profiles set role = 'student' where id = $1", [studentId]);
  await db.query(
    "insert into public.workspace_members (workspace_id, user_id, role) values ($1, $2, 'student')",
    [await workspaceOf(trainerId), studentId],
  );
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
  }

  await createAuthUser(TRAINER_A, "ana@example.com", "Ana Souza");
  await createAuthUser(TRAINER_B, "bruno@example.com", "Bruno Lima");
  await createAuthUser(STUDENT_A1, "carla@example.com", "Carla Dias");
  await createAuthUser(STUDENT_A2, "diego@example.com", "Diego Alves");
  await enrollStudent(STUDENT_A1, TRAINER_A);
  await enrollStudent(STUDENT_A2, TRAINER_A);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("sign-up trigger", () => {
  it("creates a trainer profile, workspace and owner membership", async () => {
    const profile = await db.query<{ full_name: string; role: string }>(
      "select full_name, role from public.profiles where id = $1",
      [TRAINER_A],
    );
    expect(profile.rows).toEqual([{ full_name: "Ana Souza", role: "trainer" }]);

    const membership = await db.query<{ role: string; name: string }>(
      `select m.role, w.name from public.workspace_members m
       join public.workspaces w on w.id = m.workspace_id where m.user_id = $1`,
      [TRAINER_A],
    );
    expect(membership.rows).toEqual([{ role: "owner", name: "Equipe de Ana Souza" }]);
  });

  it("ignores a role supplied in user metadata", async () => {
    const id = "00000000-0000-4000-8000-0000000000ee";
    await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [
      id,
      "eve@example.com",
      JSON.stringify({ full_name: "Eve", role: "student" }),
    ]);
    const { rows } = await db.query<{ role: string }>(
      "select role from public.profiles where id = $1",
      [id],
    );
    expect(rows[0].role).toBe("trainer");
  });

  it("falls back to the e-mail local part when no name is given", async () => {
    const id = "00000000-0000-4000-8000-0000000000ef";
    await createAuthUser(id, "frank.costa@example.com");
    const { rows } = await db.query<{ full_name: string }>(
      "select full_name from public.profiles where id = $1",
      [id],
    );
    expect(rows[0].full_name).toBe("frank.costa");
  });
});

describe("anonymous access", () => {
  it("cannot read any table", async () => {
    for (const table of ["profiles", "workspaces", "workspace_members"]) {
      await expect(asUser(null, () => db.query(`select * from public.${table}`))).rejects.toThrow(
        /permission denied/,
      );
    }
  });
});

describe("profiles", () => {
  it("trainer sees self and own students, not other trainers", async () => {
    const { rows } = await asUser(TRAINER_A, () =>
      db.query<{ id: string }>("select id from public.profiles order by id"),
    );
    expect(rows.map((r) => r.id).sort()).toEqual([TRAINER_A, STUDENT_A1, STUDENT_A2].sort());
  });

  it("other trainer cannot see trainer A's students", async () => {
    const { rows } = await asUser(TRAINER_B, () =>
      db.query<{ id: string }>("select id from public.profiles"),
    );
    expect(rows.map((r) => r.id)).toEqual([TRAINER_B]);
  });

  it("student sees self and their trainer, never another student", async () => {
    const { rows } = await asUser(STUDENT_A1, () =>
      db.query<{ id: string }>("select id from public.profiles"),
    );
    expect(rows.map((r) => r.id).sort()).toEqual([TRAINER_A, STUDENT_A1].sort());
  });

  it("user can update own full_name", async () => {
    await asUser(TRAINER_A, () =>
      db.query("update public.profiles set full_name = 'Ana S.' where id = $1", [TRAINER_A]),
    );
    const { rows } = await db.query<{ full_name: string }>(
      "select full_name from public.profiles where id = $1",
      [TRAINER_A],
    );
    expect(rows[0].full_name).toBe("Ana S.");
  });

  it("user cannot update someone else's profile", async () => {
    const result = await asUser(TRAINER_A, () =>
      db.query("update public.profiles set full_name = 'Hacked' where id = $1", [STUDENT_A1]),
    );
    expect(result.affectedRows).toBe(0);
  });

  it("user cannot change their own role", async () => {
    await expect(
      asUser(STUDENT_A1, () =>
        db.query("update public.profiles set role = 'trainer' where id = $1", [STUDENT_A1]),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("user cannot insert or delete profiles directly", async () => {
    await expect(
      asUser(TRAINER_A, () =>
        db.query("insert into public.profiles (id, full_name, role) values ($1, 'X Y', 'trainer')", [
          TRAINER_B,
        ]),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(TRAINER_A, () => db.query("delete from public.profiles where id = $1", [TRAINER_A])),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("workspaces", () => {
  it("members see only their workspace", async () => {
    const workspaceA = await workspaceOf(TRAINER_A);
    for (const user of [TRAINER_A, STUDENT_A1]) {
      const { rows } = await asUser(user, () =>
        db.query<{ id: string }>("select id from public.workspaces"),
      );
      expect(rows.map((r) => r.id)).toEqual([workspaceA]);
    }
  });

  it("owner can rename their workspace", async () => {
    const workspaceA = await workspaceOf(TRAINER_A);
    const result = await asUser(TRAINER_A, () =>
      db.query("update public.workspaces set name = 'Studio Ana' where id = $1", [workspaceA]),
    );
    expect(result.affectedRows).toBe(1);
  });

  it("student and other trainers cannot rename it", async () => {
    const workspaceA = await workspaceOf(TRAINER_A);
    for (const user of [STUDENT_A1, TRAINER_B]) {
      const result = await asUser(user, () =>
        db.query("update public.workspaces set name = 'Hacked' where id = $1", [workspaceA]),
      );
      expect(result.affectedRows).toBe(0);
    }
  });

  it("owner cannot transfer ownership", async () => {
    const workspaceA = await workspaceOf(TRAINER_A);
    await expect(
      asUser(TRAINER_A, () =>
        db.query("update public.workspaces set owner_id = $1 where id = $2", [TRAINER_B, workspaceA]),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("workspace_members", () => {
  it("trainer sees all members of their workspace", async () => {
    const { rows } = await asUser(TRAINER_A, () =>
      db.query<{ user_id: string }>("select user_id from public.workspace_members"),
    );
    expect(rows.map((r) => r.user_id).sort()).toEqual([TRAINER_A, STUDENT_A1, STUDENT_A2].sort());
  });

  it("student sees only their own membership", async () => {
    const { rows } = await asUser(STUDENT_A1, () =>
      db.query<{ user_id: string }>("select user_id from public.workspace_members"),
    );
    expect(rows.map((r) => r.user_id)).toEqual([STUDENT_A1]);
  });

  it("users cannot add themselves to another workspace", async () => {
    const workspaceA = await workspaceOf(TRAINER_A);
    await expect(
      asUser(TRAINER_B, () =>
        db.query(
          "insert into public.workspace_members (workspace_id, user_id, role) values ($1, $2, 'trainer')",
          [workspaceA, TRAINER_B],
        ),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("student cannot promote themselves", async () => {
    await expect(
      asUser(STUDENT_A1, () =>
        db.query("update public.workspace_members set role = 'owner' where user_id = $1", [
          STUDENT_A1,
        ]),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("private helpers", () => {
  it("are not callable by anonymous users", async () => {
    await expect(
      asUser(null, () => db.query("select private.is_workspace_member(gen_random_uuid())")),
    ).rejects.toThrow(/permission denied/);
  });
});
