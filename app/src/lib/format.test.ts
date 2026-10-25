import { describe, expect, it } from "vitest";
import { ageFromBirthDate, formatDate, formatNumber, parseDecimal, todayISO } from "./format";

describe("format", () => {
  it("formats dates in pt-BR without shifting date-only values", () => {
    expect(formatDate("2026-01-05")).toBe("05/01/2026");
    expect(formatDate("2026-01-05T02:00:00Z")).toBe("04/01/2026"); // 23h in São Paulo
  });

  it("formats numbers with a decimal comma", () => {
    expect(formatNumber(1234.56)).toBe("1.234,6");
    expect(formatNumber(2.5, 2)).toBe("2,5");
  });

  it("computes age on and around the birthday", () => {
    expect(ageFromBirthDate("2000-10-24", "2026-10-24")).toBe(26);
    expect(ageFromBirthDate("2000-10-25", "2026-10-24")).toBe(25);
  });

  it("returns today's São Paulo date", () => {
    expect(todayISO(new Date("2026-10-25T01:30:00Z"))).toBe("2026-10-24");
  });

  it("parses decimals with comma or dot", () => {
    expect(parseDecimal("72,5")).toBe(72.5);
    expect(parseDecimal("72.5")).toBe(72.5);
    expect(parseDecimal(" ")).toBeUndefined();
    expect(parseDecimal("7a")).toBeNaN();
    expect(parseDecimal("-3")).toBeNaN();
  });
});

describe("weekdayToday and formatDuration", () => {
  it("uses São Paulo's calendar day", async () => {
    const { weekdayToday } = await import("./format");
    // 2026-10-25 01:30 UTC is Saturday 22:30 in São Paulo.
    expect(weekdayToday(new Date("2026-10-25T01:30:00Z"))).toBe(6);
  });

  it("formats durations", async () => {
    const { formatDuration } = await import("./format");
    expect(formatDuration("2026-01-01T10:00:00Z", "2026-01-01T10:47:00Z")).toBe("47 min");
    expect(formatDuration("2026-01-01T10:00:00Z", "2026-01-01T11:05:00Z")).toBe("1 h 5 min");
  });
});

describe("formatVolume and addDays", () => {
  it("formats ml and liters", async () => {
    const { formatVolume } = await import("./format");
    expect(formatVolume(750)).toBe("750 ml");
    expect(formatVolume(1500)).toBe("1,5 L");
    expect(formatVolume(2250)).toBe("2,25 L");
  });
  it("adds calendar days across months", async () => {
    const { addDays } = await import("./format");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});
