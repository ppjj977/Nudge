import { describe, it, expect } from "vitest";
import { DateTime } from "luxon";
import { isPro } from "../lib/plan";

describe("isPro", () => {
  it("is false for free users", () => {
    expect(isPro({ plan: "free", plan_until: null })).toBe(false);
    expect(isPro(null)).toBe(false);
    expect(isPro({ plan: null, plan_until: null })).toBe(false);
  });

  it("is true for perpetual pro", () => {
    expect(isPro({ plan: "pro", plan_until: null })).toBe(true);
  });

  it("respects a future vs past expiry", () => {
    const future = DateTime.now().plus({ days: 5 }).toISO();
    const past = DateTime.now().minus({ days: 1 }).toISO();
    expect(isPro({ plan: "pro", plan_until: future })).toBe(true);
    expect(isPro({ plan: "pro", plan_until: past })).toBe(false);
  });
});
