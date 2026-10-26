import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type TestDb, createTestDb, uid } from "./harness";

const TRAINER = uid("a");
const OTHER = uid("b");
let t: TestDb;

beforeAll(async () => {
  t = await createTestDb();
  await t.createAuthUser(TRAINER, "ana@example.com", { full_name: "Ana" });
  await t.createAuthUser(OTHER, "bruno@example.com", { full_name: "Bruno" });
}, 60_000);

afterAll(() => t?.close());

const hit = async (user: string | null, action = "comment") =>
  (await t.asUser(user, () => t.db.query<{ ok: boolean }>("select public.check_rate_limit($1, 3, 3600) as ok", [action]))).rows[0].ok;

describe("check_rate_limit", () => {
  it("allows up to the limit per user and action, then refuses", async () => {
    expect([await hit(TRAINER), await hit(TRAINER), await hit(TRAINER), await hit(TRAINER)]).toEqual([true, true, true, false]);
    expect(await hit(TRAINER, "invite")).toBe(true);
    expect(await hit(OTHER)).toBe(true);
  });

  it("rejects guests and malformed actions, and is not callable as a table", async () => {
    await expect(hit(null)).rejects.toThrow(/permission denied/);
    await expect(hit(TRAINER, "DROP TABLE")).rejects.toThrow(/invalid_rate_limit/);
    await expect(t.asUser(TRAINER, () => t.db.query("select * from private.rate_limits"))).rejects.toThrow(/permission denied/);
  });
});
