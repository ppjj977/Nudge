import Groq from "groq-sdk";
import { z } from "zod";
import { requireGroq } from "./config";
import type { Task } from "./tasks";

/**
 * AI task breakdown for executive-function support (ADHD): turn one task into a
 * short list of small, concrete, ordered steps plus a realistic time estimate.
 * Reuses the same Groq model as extraction.
 */
const Schema = z.object({
  steps: z.array(z.string()).default([]),
  estimate_minutes: z.union([z.number(), z.string(), z.null()]).optional(),
});

export interface Breakdown {
  steps: string[];
  estimateMinutes: number | null;
}

export async function breakdownTask(
  task: Pick<Task, "title" | "detail" | "category">,
): Promise<Breakdown> {
  const { apiKey, model } = requireGroq();
  const client = new Groq({ apiKey });

  const system = [
    "You help someone with ADHD actually start a task by breaking it into small, concrete, ordered steps.",
    "Rules: 3–7 steps; each step is one short physical action (start with a verb); no fluff or motivation;",
    "if the task is trivial, 2 steps is fine. Also give a realistic total time estimate in minutes.",
    'Respond ONLY as JSON: {"steps": ["…","…"], "estimate_minutes": <number>}.',
  ].join(" ");
  const userMsg = `Task: ${task.title}${task.detail ? `\nDetail: ${task.detail}` : ""}\nType: ${task.category}`;

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: userMsg },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }
  const r = Schema.safeParse(parsed);
  const steps = r.success
    ? r.data.steps.map((s) => s.trim()).filter((s) => s.length > 0).slice(0, 12)
    : [];
  let estimateMinutes: number | null = null;
  if (r.success && r.data.estimate_minutes != null && r.data.estimate_minutes !== "") {
    const n = Number(r.data.estimate_minutes);
    estimateMinutes = Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  }
  return { steps, estimateMinutes };
}
