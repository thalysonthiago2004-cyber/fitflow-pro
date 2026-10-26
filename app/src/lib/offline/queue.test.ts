import { describe, expect, it } from "vitest";
import { dropOp, enqueue, flushQueue, readQueue } from "./queue";

function memory() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
}

describe("offline queue", () => {
  it("keeps only the latest op per key", () => {
    const store = memory();
    enqueue("log", { key: "a:1", kind: "set", payload: { completed: true } }, store);
    enqueue("log", { key: "a:2", kind: "set", payload: { completed: true } }, store);
    enqueue("log", { key: "a:1", kind: "set", payload: { completed: false } }, store);
    expect(readQueue("log", store)).toEqual([
      { key: "a:2", kind: "set", payload: { completed: true } },
      { key: "a:1", kind: "set", payload: { completed: false } },
    ]);
  });

  it("stops at the first network failure and keeps the rest", async () => {
    const store = memory();
    for (const key of ["a", "b", "c"]) enqueue("log", { key, kind: "set", payload: key }, store);
    const outcome = await flushQueue("log", async (op) => {
      if (op.key === "b") throw new TypeError("Failed to fetch");
      return { ok: true };
    }, store);
    expect(outcome).toEqual({ sent: 1, rejected: [], remaining: 2 });
    expect(readQueue("log", store).map((o) => o.key)).toEqual(["b", "c"]);
  });

  it("drops and reports ops the server refuses", async () => {
    const store = memory();
    enqueue("log", { key: "a", kind: "set", payload: 1 }, store);
    enqueue("log", { key: "b", kind: "set", payload: 2 }, store);
    const outcome = await flushQueue("log", async (op) => (op.key === "a" ? { ok: false, message: "Este treino já foi concluído." } : { ok: true }), store);
    expect(outcome).toEqual({ sent: 1, rejected: [{ key: "a", message: "Este treino já foi concluído." }], remaining: 0 });
    expect(readQueue("log", store)).toEqual([]);
  });

  it("forgets a queued op when a newer save for it succeeded", () => {
    const store = memory();
    enqueue("log", { key: "a", kind: "set", payload: "old" }, store);
    enqueue("log", { key: "b", kind: "set", payload: "x" }, store);
    expect(dropOp("log", "a", store).map((o) => o.key)).toEqual(["b"]);
  });
});
