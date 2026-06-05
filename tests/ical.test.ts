import { describe, it, expect } from "vitest";
import { parseFirstEvent, extractVCalendar } from "../lib/ical";

const TZ = "Europe/London";

function wrap(vevent: string): string {
  return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${vevent}\r\nEND:VCALENDAR`;
}

describe("parseFirstEvent", () => {
  it("converts a UTC datetime into the user's local wall clock", () => {
    // 13:00 UTC in June = 14:00 BST.
    const ics = wrap(
      "BEGIN:VEVENT\r\nSUMMARY:Parents evening\r\nDTSTART:20260614T130000Z\r\nDTEND:20260614T140000Z\r\nLOCATION:Oakwood School\r\nEND:VEVENT",
    );
    const e = parseFirstEvent(ics, TZ);
    expect(e).not.toBeNull();
    expect(e!.title).toBe("Parents evening");
    expect(e!.due_type).toBe("datetime");
    expect(e!.due_at).toBe("2026-06-14T14:00:00");
    expect(e!.location).toBe("Oakwood School");
  });

  it("honours a TZID parameter", () => {
    const ics = wrap(
      "BEGIN:VEVENT\r\nSUMMARY:Dentist\r\nDTSTART;TZID=Europe/London:20260614T090000\r\nEND:VEVENT",
    );
    const e = parseFirstEvent(ics, TZ);
    expect(e!.due_at).toBe("2026-06-14T09:00:00");
    expect(e!.due_type).toBe("datetime");
  });

  it("handles an all-day event (VALUE=DATE)", () => {
    const ics = wrap(
      "BEGIN:VEVENT\r\nSUMMARY:Sports day\r\nDTSTART;VALUE=DATE:20260620\r\nDTEND;VALUE=DATE:20260621\r\nEND:VEVENT",
    );
    const e = parseFirstEvent(ics, TZ);
    expect(e!.due_type).toBe("date");
    expect(e!.due_at).toBe("2026-06-20");
    expect(e!.end_at).toBeNull(); // single all-day (DTEND exclusive next day)
  });

  it("sets end_at for a multi-day all-day event", () => {
    const ics = wrap(
      "BEGIN:VEVENT\r\nSUMMARY:Half term\r\nDTSTART;VALUE=DATE:20260601\r\nDTEND;VALUE=DATE:20260606\r\nEND:VEVENT",
    );
    const e = parseFirstEvent(ics, TZ);
    expect(e!.due_at).toBe("2026-06-01");
    expect(e!.end_at).toBe("2026-06-05"); // last inclusive day
  });

  it("unescapes summary text and returns null without a VEVENT", () => {
    const ics = wrap(
      "BEGIN:VEVENT\r\nSUMMARY:Pay\\, book\\; prep\r\nDTSTART:20260614T130000Z\r\nEND:VEVENT",
    );
    expect(parseFirstEvent(ics, TZ)!.title).toBe("Pay, book; prep");
    expect(parseFirstEvent("BEGIN:VCALENDAR\r\nEND:VCALENDAR", TZ)).toBeNull();
  });
});

describe("extractVCalendar", () => {
  it("pulls an inline VCALENDAR block out of an email body", () => {
    const body = `Hi, see invite\nBEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:X\nEND:VEVENT\nEND:VCALENDAR\nthanks`;
    const got = extractVCalendar(body);
    expect(got).toContain("BEGIN:VEVENT");
    expect(extractVCalendar("no calendar here")).toBeNull();
  });
});
