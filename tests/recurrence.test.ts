import { describe, it, expect } from "vitest";
import { parseRecurrence, advance, describeRecurrence } from "../lib/recurrence";

describe("parseRecurrence", () => {
  it("accepts valid specs and clamps interval", () => {
    expect(parseRecurrence({ freq: "weekly", interval: 1 })).toEqual({
      freq: "weekly",
      interval: 1,
    });
    expect(parseRecurrence({ freq: "monthly", interval: 0 })).toEqual({
      freq: "monthly",
      interval: 1,
    });
    expect(parseRecurrence('{"freq":"yearly","interval":2}')).toEqual({
      freq: "yearly",
      interval: 2,
    });
  });

  it("rejects junk", () => {
    expect(parseRecurrence(null)).toBeNull();
    expect(parseRecurrence("")).toBeNull();
    expect(parseRecurrence({ freq: "fortnightly", interval: 1 })).toBeNull();
    expect(parseRecurrence("not json")).toBeNull();
  });
});

describe("advance", () => {
  it("rolls a date-only value forward, preserving the date format", () => {
    expect(advance("2026-06-05", { freq: "weekly", interval: 1 })).toBe("2026-06-12");
    expect(advance("2026-06-05", { freq: "monthly", interval: 1 })).toBe("2026-07-05");
    expect(advance("2026-06-05", { freq: "yearly", interval: 1 })).toBe("2027-06-05");
    expect(advance("2026-06-05", { freq: "daily", interval: 3 })).toBe("2026-06-08");
  });

  it("preserves the time on a datetime value", () => {
    const next = advance("2026-06-05T19:00:00.000Z", { freq: "weekly", interval: 1 });
    expect(next).toContain("2026-06-12T19:00");
  });

  it("returns null for an unparseable date", () => {
    expect(advance("nope", { freq: "daily", interval: 1 })).toBeNull();
  });
});

describe("describeRecurrence", () => {
  it("labels common cases", () => {
    expect(describeRecurrence({ freq: "daily", interval: 1 })).toBe("Daily");
    expect(describeRecurrence({ freq: "weekly", interval: 1 })).toBe("Every week");
    expect(describeRecurrence({ freq: "yearly", interval: 1 })).toBe("Yearly");
    expect(describeRecurrence({ freq: "monthly", interval: 2 })).toBe("Every 2 months");
  });
});
