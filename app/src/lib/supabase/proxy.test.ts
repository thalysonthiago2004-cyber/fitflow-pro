import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ getPublicEnv: () => ({}) }));
const { isPublicPath } = await import("./proxy");

describe("isPublicPath", () => {
  it.each(["/", "/login", "/signup", "/forgot-password", "/auth/confirm", "/auth/error", "/invite/abc"])(
    "%s is public",
    (path) => expect(isPublicPath(path)).toBe(true),
  );

  it.each(["/dashboard", "/students", "/students/invite", "/settings", "/reset-password", "/loginx", "/authority", "/anything-new"])(
    "%s requires a session",
    (path) => expect(isPublicPath(path)).toBe(false),
  );
});
