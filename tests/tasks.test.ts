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

  // now = Thursday 4 Jun 2026; the current ISO week ends Sunday 7 Jun.
  it("puts tasks later this week (through Sunday) in 'week'", () => {
    expect(
      bucketFor({ due_at: "2026-06-06", due_type: "date" }, now), // Saturday
    ).toBe("week");
    expect(
      bucketFor({ due_at: "2026-06-07", due_type: "date" }, now), // Sunday (boundary)
    ).toBe("week");
  });

  it("puts next week (Monday onward) in 'later', not 'week'", () => {
    expect(
      bucketFor({ due_at: "2026-06-08", due_type: "date" }, now), // next Monday
    ).toBe("later");
    expect(
      bucketFor({ due_at: "2026-06-09", due_type: "date" }, now),
    ).toBe("later");
  });

  it("puts far-future tasks in 'later'", () => {
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
