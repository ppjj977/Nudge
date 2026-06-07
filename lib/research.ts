import Groq from "groq-sdk";
import { z } from "zod";
import { requireGroq, config } from "./config";
import type { Task } from "./tasks";

/**
 * Research (Pro): turn a vague to-do ("get the shower fixed", "need a new oven")
 * into a structured brief — a short summary, concrete options, and next steps.
 *
 * If a Tavily key is configured the brief is grounded in real web results (with
 * links); otherwise the model gives guidance + suggested searches. Reuses the
 * same Groq model as extraction.
 */
export interface ResearchOption {
  title: string;
  note: string;
  url?: string;
}
export interface ResearchResult {
  summary: string;
  options: ResearchOption[];
  next_steps: string[];
  grounded: boolean;
}

const Schema = z.object({
  summary: z.string().default(""),
  options: z
    .array(
      z.object({
        title: z.string().default(""),
        note: z.string().default(""),
        url: z.union([z.string(), z.null()]).optional(),
      }),
    )
    .default([]),
  next_steps: z.array(z.string()).default([]),
});

interface WebResult {
  title: string;
  url: string;
  content: string;
}

/** Optional web grounding via Tavily (purpose-built for LLM research). */
async function tavilySearch(query: string): Promise<WebResult[]> {
  const key = config.research.tavilyKey;
  if (!key) return [];
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query,
        search_depth: "basic",
        max_results: 6,
      }),
    });
    if (!res.ok) return [];
    const j = (await res.json()) as { results?: WebResult[] };
    return (j.results ?? []).slice(0, 6);
  } catch {
    return [];
  }
}

export async function researchTask(
  task: Pick<Task, "title" | "detail" | "location">,
  opts: { locationHint?: string | null } = {},
): Promise<ResearchResult> {
  const { apiKey, model } = requireGroq();
  const client = new Groq({ apiKey });

  const place = opts.locationHint || task.location || null;
  const query = [task.title, task.detail, place ? `near ${place}` : ""]
    .filter(Boolean)
    .join(" ")
    .slice(0, 200);

  const web = await tavilySearch(query);
  const grounded = web.length > 0;

  const system = grounded
    ? [
        "You are a practical research assistant. Use the provided web results to help the user act on a real-world to-do.",
        "Pick the most useful, relevant options (products, providers, articles) and summarise concisely.",
        'Respond ONLY as JSON: {"summary": string, "options": [{"title": string, "note": string, "url": string}], "next_steps": [string]}.',
        "Use the EXACT urls from the results. 3–5 options. next_steps = short concrete actions.",
      ].join(" ")
    : [
        "You are a practical research assistant helping someone act on a vague to-do.",
        "Give a short brief: what to consider, key options/criteria, and concrete next steps (including good search terms, since you have no live web access).",
        'Respond ONLY as JSON: {"summary": string, "options": [{"title": string, "note": string}], "next_steps": [string]}.',
        "3–5 options. Be specific and useful; no fluff.",
      ].join(" ");

  const userMsg = grounded
    ? `To-do: ${task.title}${task.detail ? `\nDetail: ${task.detail}` : ""}${place ? `\nArea: ${place}` : ""}\n\nWeb results:\n${web
        .map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.content.slice(0, 400)}`)
        .join("\n\n")}`
    : `To-do: ${task.title}${task.detail ? `\nDetail: ${task.detail}` : ""}${place ? `\nArea: ${place}` : ""}`;

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.3,
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
  if (!r.success) {
    return { summary: "Couldn’t put a brief together — try again.", options: [], next_steps: [], grounded };
  }
  return {
    summary: r.data.summary.trim(),
    options: r.data.options
      .map((o) => ({
        title: o.title.trim(),
        note: o.note.trim(),
        url: typeof o.url === "string" && /^https?:\/\//.test(o.url) ? o.url : undefined,
      }))
      .filter((o) => o.title.length > 0)
      .slice(0, 6),
    next_steps: r.data.next_steps.map((s) => s.trim()).filter(Boolean).slice(0, 8),
    grounded,
  };
}
