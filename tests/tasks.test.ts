import { describe, it, expect } from "vitest";
import { DateTime } from "luxon";
import { bucketFor } from "../lib/tasks";

const now = DateTime.fromISO("2026-06-04T09:00:00", { zone: "Europe/London" });

describe("bucketFor", () => {
  it("puts undated tasks in 'later'", () => {
    expect(bucketFor({ due_at: null, due_type: "none" }, now)).toBe("later");
  });

  it("puts tasks due today in 'today'", () => {
    expect(
      bucketFor({ due_at: "2026-06-04", due_type: "date" }, now),
    ).toBe("today");
  });

  it("surfaces overdue tasks under 'today'", () => {
    expect(
      bucketFor({ due_at: "2026-05-30", due_type: "date" }, now),
    ).toBe("today");
  });

  it("puts tasks within 7 days in 'week'", () => {
    expect(
      bucketFor({ due_at: "2026-06-09", due_type: "date" }, now),
    ).toBe("week");
  });

  it("puts tasks beyond 7 days in 'later'", () => {
    expect(
      bucketFor({ due_at: "2026-07-15", due_type: "date" }, now),
    ).toBe("later");
  });

  it("treats an unparseable date as undated", () => {
    expect(
      bucketFor({ due_at: "not-a-date", due_type: "date" }, now),
    ).toBe("later");
  });
});
