import { describe, it, expect } from "vitest";
import { DateTime } from "luxon";
import {
  computeFireTimes,
  exactTimeFire,
  parseUserSettings,
  DEFAULT_REMINDER_RULES,
  isValidRule,
} from "../lib/reminders";

const TZ = "Europe/London";
const localTimes = (iso: string[]) =>
  iso.map((f) => DateTime.fromISO(f).setZone(TZ).toFormat("yyyy-LL-dd HH:mm"));

describe("computeFireTimes", () => {
  const now = DateTime.fromISO("2026-06-04T08:00", { zone: TZ });

  it("returns nothing for undated tasks", () => {
    expect(
      computeFireTimes({ due_at: null, due_type: "none" }, [{ daysBefore: 1, time: "09:00" }], TZ, now),
    ).toEqual([]);
  });

  it("anchors each rule to the due date at the given local time", () => {
    const fires = computeFireTimes(
      { due_at: "2026-06-05", due_type: "date" },
      [
        { daysBefore: 1, time: "21:00" }, // 9pm the day before
        { daysBefore: 0, time: "10:00" }, // 10am the morning of
      ],
      TZ,
      now,
    );
    expect(localTimes(fires)).toEqual([
      "2026-06-04 21:00",
      "2026-06-05 10:00",
    ]);
  });

  it("skips fire times already in the past", () => {
    const late = DateTime.fromISO("2026-06-04T22:00", { zone: TZ });
    const fires = computeFireTimes(
      { due_at: "2026-06-05", due_type: "date" },
      [
        { daysBefore: 1, time: "21:00" }, // already passed at 22:00
        { daysBefore: 0, time: "10:00" },
      ],
      TZ,
      late,
    );
    expect(localTimes(fires)).toEqual(["2026-06-05 10:00"]);
  });

  it("handles '1 week before'", () => {
    const fires = computeFireTimes(
      { due_at: "2026-06-20", due_type: "date" },
      [{ daysBefore: 7, time: "09:00" }],
      TZ,
      now,
    );
    expect(localTimes(fires)).toEqual(["2026-06-13 09:00"]);
  });

  it("dedupes identical fire times", () => {
    const fires = computeFireTimes(
      { due_at: "2026-06-10", due_type: "date" },
      [
        { daysBefore: 1, time: "09:00" },
        { daysBefore: 1, time: "09:00" },
      ],
      TZ,
      now,
    );
    expect(fires).toHaveLength(1);
  });
});

describe("exactTimeFire", () => {
  const now = DateTime.fromISO("2026-06-04T08:00", { zone: TZ });

  it("fires at the exact due time for a timed task", () => {
    const iso = exactTimeFire(
      { due_at: "2026-06-05T14:30", due_type: "datetime" },
      TZ,
      now,
    );
    expect(iso).not.toBeNull();
    expect(localTimes([iso!])).toEqual(["2026-06-05 14:30"]);
  });

  it("returns null for date-only and undated tasks (no time set)", () => {
    expect(exactTimeFire({ due_at: "2026-06-05", due_type: "date" }, TZ, now)).toBeNull();
    expect(exactTimeFire({ due_at: null, due_type: "none" }, TZ, now)).toBeNull();
  });

  it("returns null when the time has already passed", () => {
    expect(
      exactTimeFire({ due_at: "2026-06-04T07:00", due_type: "datetime" }, TZ, now),
    ).toBeNull();
  });
});

describe("isValidRule", () => {
  it("accepts well-formed rules", () => {
    expect(isValidRule({ daysBefore: 0, time: "07:30" })).toBe(true);
    expect(isValidRule({ daysBefore: 14, time: "23:59" })).toBe(true);
  });
  it("rejects bad times and negative offsets", () => {
    expect(isValidRule({ daysBefore: 1, time: "25:00" })).toBe(false);
    expect(isValidRule({ daysBefore: -1, time: "09:00" })).toBe(false);
    expect(isValidRule({ daysBefore: 1, time: "9am" })).toBe(false);
  });
});

describe("parseUserSettings", () => {
  it("falls back to defaults when settings are empty", () => {
    const { rules, channels } = parseUserSettings({ settings: null });
    expect(rules.pay).toEqual(DEFAULT_REMINDER_RULES.pay);
    expect(channels).toEqual({ email: true, push: true });
  });

  it("lets stored rules override per category, including an explicit empty list", () => {
    const settings = JSON.stringify({
      reminderRules: {
        pay: [{ daysBefore: 5, time: "08:00" }],
        attend: [], // user wants no attend reminders
      },
      channels: { email: true, push: false },
    });
    const { rules, channels } = parseUserSettings({ settings });
    expect(rules.pay).toEqual([{ daysBefore: 5, time: "08:00" }]);
    expect(rules.attend).toEqual([]); // respected, not defaulted
    expect(rules.prepare).toEqual(DEFAULT_REMINDER_RULES.prepare); // untouched -> default
    expect(channels).toEqual({ email: true, push: false });
  });

  it("drops malformed stored rules", () => {
    const settings = JSON.stringify({
      reminderRules: { pay: [{ daysBefore: 1, time: "nope" }, { daysBefore: 2, time: "09:00" }] },
    });
    expect(parseUserSettings({ settings }).rules.pay).toEqual([
      { daysBefore: 2, time: "09:00" },
    ]);
  });
});
