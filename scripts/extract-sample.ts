import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DateTime } from "luxon";
import { loadEnv } from "./_env";

/**
 * Offline harness for proving extraction quality (SPEC phase 1 goal). Runs the
 * extractor over /samples and prints what it would create — no DB writes.
 *
 *   npm run extract:sample              # all samples
 *   npm run extract:sample bill.txt     # one sample
 *
 * Requires GROQ_API_KEY and GROQ_MODEL.
 */
async function main() {
  loadEnv();
  const { extract } = await import("../lib/extract");
  const { config } = await import("../lib/config");

  const samplesDir = join(process.cwd(), "samples");
  const only = process.argv[2];

  const files = readdirSync(samplesDir)
    .filter((f) => f.endsWith(".txt"))
    .filter((f) => (only ? f === only : true))
    .sort();

  if (files.length === 0) {
    console.error("No matching .txt samples in /samples.");
    process.exit(1);
  }

  const tz = config.defaultUser.timezone;
  const now = DateTime.now().setZone(tz);
  console.log(`Today: ${now.toFormat("yyyy-LL-dd cccc")}  TZ: ${tz}`);
  console.log(`Model: ${config.groq.model ?? "(GROQ_MODEL unset!)"}\n`);

  let failures = 0;
  for (const file of files) {
    const text = readFileSync(join(samplesDir, file), "utf8");
    console.log(`\n=== ${file} ===`);
    try {
      const result = await extract(text, { timezone: tz, now });
      if (result.nothing_actionable) {
        console.log("  (nothing actionable)");
        continue;
      }
      for (const item of result.items) {
        const conf = Math.round(item.confidence * 100);
        const tray =
          item.confidence < config.extraction.confidenceThreshold
            ? " [REVIEW]"
            : "";
        console.log(
          `  • [${item.category}] ${item.title}` +
            `${item.due_at ? `  due ${item.due_at}` : ""}` +
            `${item.amount != null ? `  ${item.currency} ${item.amount}` : ""}` +
            `  (${conf}%)${tray}`,
        );
        if (item.source_excerpt) console.log(`      “${item.source_excerpt}”`);
      }
    } catch (err) {
      failures++;
      console.error(`  ! extraction failed: ${(err as Error).message}`);
    }
  }

  console.log(`\nDone. ${failures} failure(s).`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
