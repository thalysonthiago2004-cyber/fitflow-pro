import { describe, expect, it } from "vitest";
import { capSessionCookie } from "./cookies";

describe("capSessionCookie", () => {
  it("caps the library's 400-day lifetime at 30 days and keeps the cookie httpOnly", () => {
    expect(capSessionCookie({ maxAge: 400 * 86400, path: "/" })).toMatchObject({ maxAge: 30 * 86400, httpOnly: true, sameSite: "lax", path: "/" });
  });
  it("keeps deletions as deletions", () => {
    expect(capSessionCookie({ maxAge: 0 }).maxAge).toBe(0);
  });
});
