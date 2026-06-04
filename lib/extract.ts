import { readFileSync } from "node:fs";
import { join } from "node:path";
import Groq from "groq-sdk";
import { z } from "zod";
import { DateTime } from "luxon";
import {
  ACTION_CATEGORIES,
  CATEGORIES,
  DUE_TYPES,
  LIFE_AREAS,
} from "./categories";
import { requireGroq } from "./config";

/* -------------------------------------------------------------------------- */
/* Schema — the contract (SPEC §7). Everything downstream reads this.          */
/* -------------------------------------------------------------------------- */

// Models sometimes emit "" or stray strings where we want null. Coerce gently.
const nullableString = z
  .union([z.string(), z.null()])
  .transform((v) => (v && v.trim().length > 0 ? v.trim() : null));

const nullableNumber = z
  .union([z.number(), z.string(), z.null()])
  .transform((v) => {
    if (v === null || v === "") return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  });

export const ExtractedItemSchema = z
  .object({
    category: z.enum(CATEGORIES),
    title: z.string().min(1).transform((s) => s.trim()),
    detail: nullableString.optional().default(null),
    due_at: nullableString.optional().default(null),
    due_type: z.enum(DUE_TYPES).default("none"),
    amount: nullableNumber.optional().default(null),
    currency: nullableString.optional().default(null),
    location: nullableString.optional().default(null),
    life_area: z
      .union([z.enum(LIFE_AREAS), z.null()])
      .optional()
      .transform((v) => v ?? "other"),
    confidence: z
      .union([z.number(), z.string()])
      .transform((v) => (typeof v === "number" ? v : Number(v)))
      .pipe(z.number())
      // clamp into range; never trust the model's bounds
      .transform((n) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0))),
    source_excerpt: nullableString.optional().default(null),
  })
  .transform((item) => {
    // Hard rule (SPEC §7.4): due_at must be null when due_type is none.
    if (item.due_type === "none") return { ...item, due_at: null };
    return item;
  });

export type ExtractedItem = z.infer<typeof ExtractedItemSchema>;

export const ExtractionResultSchema = z.object({
  nothing_actionable: z.boolean().default(false),
  items: z.array(ExtractedItemSchema).default([]),
});

export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

/* -------------------------------------------------------------------------- */
/* Pure helpers — unit-tested without a network call.                          */
/* -------------------------------------------------------------------------- */

/**
 * Strip markdown code fences and any leading/trailing prose, then isolate the
 * outermost JSON object. The prompt forbids fences, but defend anyway (SPEC §7).
 */
export function stripToJson(raw: string): string {
  let s = raw.trim();

  // ```json ... ``` or ``` ... ```
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();

  // Fall back to the outermost { ... } if there is surrounding chatter.
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    s = s.slice(first, last + 1);
  }
  return s.trim();
}

/**
 * Parse + validate a raw model response into a typed result. Throws on
 * unparseable / invalid output so the caller can mark the capture `failed`
 * rather than crash (SPEC §7).
 */
export function parseExtraction(raw: string): ExtractionResult {
  const json = stripToJson(raw);
  let obj: unknown;
  try {
    obj = JSON.parse(json);
  } catch (err) {
    throw new ExtractionParseError(
      `Model output was not valid JSON: ${(err as Error).message}`,
      raw,
    );
  }
  const parsed = ExtractionResultSchema.safeParse(obj);
  if (!parsed.success) {
    throw new ExtractionParseError(
      `Model output failed schema validation: ${parsed.error.message}`,
      raw,
    );
  }
  return normalizeResult(parsed.data);
}

/**
 * Post-validation cleanup: drop empty-title items, and ensure non-`pay`
 * items don't carry a stray amount/currency that would confuse the UI.
 */
function normalizeResult(result: ExtractionResult): ExtractionResult {
  const items = result.items
    .filter((i) => i.title.length > 0)
    .map((i) => {
      if (i.category !== "pay") {
        return { ...i, amount: null, currency: null };
      }
      // Default currency for pay items with an amount but no code (SPEC §5).
      if (i.amount !== null && !i.currency) {
        return { ...i, currency: "GBP" };
      }
      return i;
    });
  return {
    nothing_actionable: result.nothing_actionable && items.length === 0,
    items,
  };
}

export class ExtractionParseError extends Error {
  raw: string;
  constructor(message: string, raw: string) {
    super(message);
    this.name = "ExtractionParseError";
    this.raw = raw;
  }
}

/* -------------------------------------------------------------------------- */
/* Prompt assembly                                                             */
/* -------------------------------------------------------------------------- */

let cachedTemplate: string | null = null;

function promptTemplate(): string {
  if (cachedTemplate === null) {
    cachedTemplate = readFileSync(
      join(process.cwd(), "prompts", "extract.system.md"),
      "utf8",
    );
  }
  return cachedTemplate;
}

export interface ExtractionContext {
  /** IANA timezone, e.g. Europe/London. */
  timezone: string;
  /** Override "now" for deterministic tests; defaults to current time. */
  now?: DateTime;
}

export function buildSystemPrompt(ctx: ExtractionContext): string {
  const now = (ctx.now ?? DateTime.now()).setZone(ctx.timezone);
  return promptTemplate()
    .replaceAll("{{TODAY}}", now.toFormat("yyyy-LL-dd"))
    .replaceAll("{{WEEKDAY}}", now.toFormat("cccc"))
    .replaceAll("{{TIMEZONE}}", ctx.timezone);
}

/* -------------------------------------------------------------------------- */
/* The Groq call                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Extract structured items from already-normalized plain text (SPEC §7).
 * Returns a validated result; throws ExtractionParseError on bad output.
 */
export async function extract(
  normalizedText: string,
  ctx: ExtractionContext,
): Promise<ExtractionResult> {
  const { apiKey, model } = requireGroq();
  const client = new Groq({ apiKey });

  const completion = await client.chat.completions.create({
    model,
    temperature: 0,
    // Force JSON output where the model supports it; we still strip/validate.
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: buildSystemPrompt(ctx) },
      { role: "user", content: normalizedText },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  return parseExtraction(raw);
}

export { ACTION_CATEGORIES };
