import { afterEach, describe, expect, it, vi } from "vitest";

const captureMessage = vi.fn();
vi.mock("@sentry/nextjs", () => ({ captureMessage }));
const { loggingFetch, shouldAlert } = await import("./logging-fetch");

afterEach(() => {
  vi.restoreAllMocks();
  captureMessage.mockReset();
});

const respond = (status: number, body: unknown) => vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe("loggingFetch", () => {
  it("passes successful responses through untouched", async () => {
    respond(200, { ok: true });
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await loggingFetch("server")("https://x.supabase.co/rest/v1/foods?select=*", { method: "GET" });
    expect(await res.json()).toEqual({ ok: true });
    expect(log).not.toHaveBeenCalled();
  });

  it("alerts on server errors and RLS denials, without the query string", async () => {
    respond(403, { code: "42501", message: "new row violates row-level security policy" });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await loggingFetch("server")("https://x.supabase.co/rest/v1/body_measurements?student_id=eq.123", { method: "POST", body: '{"weight_kg":72}' });
    const logged = error.mock.calls[0][1] as string;
    expect(JSON.parse(logged)).toEqual({ scope: "server", method: "POST", path: "/rest/v1/body_measurements", status: 403, code: "42501", message: "new row violates row-level security policy" });
    expect(logged).not.toContain("72");
    expect(captureMessage).toHaveBeenCalledOnce();
  });

  it("only warns about expected outcomes", async () => {
    respond(409, { code: "23505", message: "duplicate key" });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await loggingFetch("server")("https://x.supabase.co/rest/v1/foods", { method: "POST" });
    expect(warn).toHaveBeenCalledOnce();
    expect(captureMessage).not.toHaveBeenCalled();
    expect(shouldAlert({ scope: "s", method: "POST", path: "/auth/v1/token", status: 400, code: "invalid_credentials" })).toBe(false);
  });
});
