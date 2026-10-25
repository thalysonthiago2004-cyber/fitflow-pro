import { describe, expect, it } from "vitest";
import { parseEmailOtpType } from "./otp";

describe("parseEmailOtpType", () => {
  it.each(["signup", "recovery", "email", "invite"])("accepts %s", (type) => {
    expect(parseEmailOtpType(type)).toBe(type);
  });

  it.each([null, "", "sms", "RECOVERY", "recovery "])("rejects %s", (type) => {
    expect(parseEmailOtpType(type)).toBeNull();
  });
});
