import { DateTime } from "luxon";

/**
 * Minimal iCalendar (RFC 5545) reader — enough to turn a forwarded calendar
 * invite (.ics) into a precise task. We pull the first VEVENT's summary, start
 * (with timezone), end, location and description. Times are returned as a local
 * wall-clock ISO string in the user's zone, matching how the rest of the app
 * stores due_at (the reminder engine interprets due_at in the user's timezone).
 */
export interface IcalEvent {
  title: string;
  due_at: string;
  due_type: "datetime" | "date";
  end_at: string | null;
  location: string | null;
  detail: string | null;
}

/** Unescape RFC 5545 TEXT values (\n \, \; \\). */
function unescapeText(v: string): string {
  return v
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

/** Parse a DTSTART/DTEND value + params into a local wall-clock ISO. */
function parseDate(
  value: string,
  params: Record<string, string>,
  zone: string,
): { iso: string; dateOnly: boolean } | null {
  const v = value.trim();
  // All-day: VALUE=DATE or a bare YYYYMMDD.
  if (params.VALUE === "DATE" || /^\d{8}$/.test(v)) {
    const d = DateTime.fromFormat(v.slice(0, 8), "yyyyMMdd", { zone });
    return d.isValid ? { iso: d.toFormat("yyyy-LL-dd"), dateOnly: true } : null;
  }
  // Date-time: YYYYMMDDTHHMMSS, optionally trailing Z (UTC) or a TZID param.
  const isUtc = /z$/i.test(v);
  const core = isUtc ? v.slice(0, -1) : v;
  let dt: DateTime;
  if (isUtc) {
    dt = DateTime.fromFormat(core, "yyyyMMdd'T'HHmmss", { zone: "utc" });
  } else if (params.TZID) {
    dt = DateTime.fromFormat(core, "yyyyMMdd'T'HHmmss", { zone: params.TZID });
    if (!dt.isValid) dt = DateTime.fromFormat(core, "yyyyMMdd'T'HHmmss", { zone });
  } else {
    dt = DateTime.fromFormat(core, "yyyyMMdd'T'HHmmss", { zone }); // floating
  }
  if (!dt.isValid) return null;
  return { iso: dt.setZone(zone).toFormat("yyyy-LL-dd'T'HH:mm:ss"), dateOnly: false };
}

/** Pull the first VCALENDAR block out of arbitrary text (inline invites). */
export function extractVCalendar(text: string): string | null {
  if (!text) return null;
  const m = text.match(/BEGIN:VCALENDAR[\s\S]*?END:VCALENDAR/i);
  return m ? m[0] : null;
}

/** Parse the first VEVENT in an iCalendar string into an event, or null. */
export function parseFirstEvent(ics: string, zone: string): IcalEvent | null {
  if (!ics || !/BEGIN:VEVENT/i.test(ics)) return null;
  // Unfold continuation lines (a CRLF/LF followed by a space or tab).
  const lines = ics.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const start = lines.findIndex((l) => /^BEGIN:VEVENT/i.test(l));
  if (start < 0) return null;
  const endIdx = lines.findIndex((l, i) => i > start && /^END:VEVENT/i.test(l));

  const props: Record<string, { value: string; params: Record<string, string> }> = {};
  for (const line of lines.slice(start + 1, endIdx < 0 ? undefined : endIdx)) {
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const [name, ...paramParts] = line.slice(0, colon).split(";");
    const params: Record<string, string> = {};
    for (const p of paramParts) {
      const eq = p.indexOf("=");
      if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1);
    }
    const key = name.toUpperCase();
    if (!(key in props)) props[key] = { value: line.slice(colon + 1), params };
  }

  const dtstart = props.DTSTART;
  if (!dtstart) return null;
  const begin = parseDate(dtstart.value, dtstart.params, zone);
  if (!begin) return null;

  let end_at: string | null = null;
  if (props.DTEND) {
    const e = parseDate(props.DTEND.value, props.DTEND.params, zone);
    if (e) {
      if (begin.dateOnly && e.dateOnly) {
        // All-day DTEND is exclusive; the last day is one before it.
        const last = DateTime.fromISO(e.iso, { zone }).minus({ days: 1 });
        if (last.isValid && last.toFormat("yyyy-LL-dd") > begin.iso) {
          end_at = last.toFormat("yyyy-LL-dd");
        }
      } else if (!begin.dateOnly && !e.dateOnly) {
        const sd = begin.iso.slice(0, 10);
        const ed = e.iso.slice(0, 10);
        if (ed > sd) end_at = ed;
      }
    }
  }

  const title = props.SUMMARY ? unescapeText(props.SUMMARY.value) : "";
  const location = props.LOCATION ? unescapeText(props.LOCATION.value) || null : null;
  const detail = props.DESCRIPTION
    ? unescapeText(props.DESCRIPTION.value).slice(0, 500) || null
    : null;

  return {
    title: title || "Event",
    due_at: begin.iso,
    due_type: begin.dateOnly ? "date" : "datetime",
    end_at,
    location,
    detail,
  };
}
