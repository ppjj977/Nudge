import { describe, it, expect } from "vitest";
import {
  stripToJson,
  parseExtraction,
  ExtractionParseError,
  buildSystemPrompt,
  coerceLifeAreas,
} from "../lib/extract";
import { DateTime } from "luxon";

describe("stripToJson", () => {
  it("removes ```json fences", () => {
    const raw = '```json\n{"nothing_actionable":true,"items":[]}\n```';
    expect(JSON.parse(stripToJson(raw))).toEqual({
      nothing_actionable: true,
      items: [],
    });
  });

  it("removes bare ``` fences", () => {
    const raw = '```\n{"a":1}\n```';
    expect(stripToJson(raw)).toBe('{"a":1}');
  });

  it("isolates the JSON object from surrounding prose", () => {
    const raw = 'Sure! Here you go:\n{"items":[]}\nHope that helps.';
    expect(stripToJson(raw)).toBe('{"items":[]}');
  });
});

describe("parseExtraction", () => {
  it("parses a well-formed pay item", () => {
    const raw = JSON.stringify({
      nothing_actionable: false,
      items: [
        {
          category: "pay",
          title: "Pay school trip (£15)",
          detail: "Year 4 museum trip",
          due_at: "2026-06-15",
          due_type: "date",
          amount: 15,
          currency: "GBP",
          location: null,
          life_area: "school",
          confidence: 0.93,
          source_excerpt: "pay £15 by the 15th",
        },
      ],
    });
    const result = parseExtraction(raw);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      category: "pay",
      amount: 15,
      currency: "GBP",
      due_type: "date",
    });
  });

  it("nulls due_at when due_type is none (hard rule §7.4)", () => {
    const raw = JSON.stringify({
      items: [
        {
          category: "reminder",
          title: "Call the dentist",
          due_at: "sometime",
          due_type: "none",
          confidence: 0.7,
        },
      ],
    });
    const result = parseExtraction(raw);
    expect(result.items[0].due_at).toBeNull();
  });

  it("strips amount/currency from non-pay items", () => {
    const raw = JSON.stringify({
      items: [
        {
          category: "attend",
          title: "Sports day",
          due_type: "date",
          due_at: "2026-06-20",
          amount: 99,
          currency: "GBP",
          confidence: 0.8,
        },
      ],
    });
    const result = parseExtraction(raw);
    expect(result.items[0].amount).toBeNull();
    expect(result.items[0].currency).toBeNull();
  });

  it("defaults currency to GBP for a pay item missing it", () => {
    const raw = JSON.stringify({
      items: [
        {
          category: "pay",
          title: "Pay club fees",
          due_type: "date",
          due_at: "2026-07-01",
          amount: 30,
          confidence: 0.9,
        },
      ],
    });
    expect(parseExtraction(raw).items[0].currency).toBe("GBP");
  });

  it("clamps confidence into 0..1", () => {
    const raw = JSON.stringify({
      items: [
        { category: "send", title: "Send X", due_type: "none", confidence: 4 },
      ],
    });
    expect(parseExtraction(raw).items[0].confidence).toBe(1);
  });

  it("normalizes nothing_actionable to true only when no items survive", () => {
    const raw = JSON.stringify({ nothing_actionable: true, items: [] });
    expect(parseExtraction(raw).nothing_actionable).toBe(true);
  });

  it("treats empty-string fields as null", () => {
    const raw = JSON.stringify({
      items: [
        {
          category: "send",
          title: "Reply to Dana",
          detail: "",
          due_type: "none",
          confidence: 0.6,
          source_excerpt: "",
        },
      ],
    });
    const item = parseExtraction(raw).items[0];
    expect(item.detail).toBeNull();
    expect(item.source_excerpt).toBeNull();
  });

  it("keeps a grouped event task's checklist (trimming blanks)", () => {
    const raw = JSON.stringify({
      items: [
        {
          category: "attend",
          title: "Sports Day",
          due_type: "date",
          due_at: "2026-06-05",
          confidence: 0.9,
          checklist: ["Wear PE kit", "  ", "Bring water bottle", null],
        },
      ],
    });
    const item = parseExtraction(raw).items[0];
    expect(item.checklist).toEqual(["Wear PE kit", "Bring water bottle"]);
  });

  it("leaves checklist null for ordinary tasks", () => {
    const raw = JSON.stringify({
      items: [
        { category: "pay", title: "Pay bill", due_type: "none", confidence: 0.9 },
      ],
    });
    expect(parseExtraction(raw).items[0].checklist).toBeNull();
  });

  it("nulls an empty checklist array", () => {
    const raw = JSON.stringify({
      items: [
        {
          category: "attend",
          title: "Thing",
          due_type: "none",
          confidence: 0.9,
          checklist: [],
        },
      ],
    });
    expect(parseExtraction(raw).items[0].checklist).toBeNull();
  });

  it("throws ExtractionParseError on non-JSON", () => {
    expect(() => parseExtraction("not json at all")).toThrow(
      ExtractionParseError,
    );
  });

  it("throws ExtractionParseError on an unknown category", () => {
    const raw = JSON.stringify({
      items: [{ category: "buy", title: "X", due_type: "none", confidence: 1 }],
    });
    expect(() => parseExtraction(raw)).toThrow(ExtractionParseError);
  });
});

describe("buildSystemPrompt", () => {
  it("injects today's date and timezone", () => {
    const now = DateTime.fromISO("2026-06-04T09:00:00", {
      zone: "Europe/London",
    });
    const prompt = buildSystemPrompt({ timezone: "Europe/London", now });
    expect(prompt).toContain("2026-06-04");
    expect(prompt).toContain("Thursday");
    expect(prompt).toContain("Europe/London");
    expect(prompt).not.toContain("{{TODAY}}");
  });

  it("injects the user's custom life areas", () => {
    const prompt = buildSystemPrompt({
      timezone: "Europe/London",
      lifeAreas: ["kids", "side hustle", "admin"],
    });
    expect(prompt).toContain("kids, side hustle, admin");
    expect(prompt).not.toContain("{{LIFE_AREAS}}");
  });
});

describe("coerceLifeAreas", () => {
  const result = {
    nothing_actionable: false,
    items: [
      { category: "pay", title: "A", due_type: "none", life_area: "kids" } as never,
      { category: "send", title: "B", due_type: "none", life_area: "school" } as never,
      { category: "send", title: "C", due_type: "none", life_area: null } as never,
    ],
  };

  it("keeps areas in the user's set and nulls the rest", () => {
    const out = coerceLifeAreas(result, ["kids", "admin"]);
    expect(out.items.map((i) => i.life_area)).toEqual(["kids", null, null]);
  });
});
