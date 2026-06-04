import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnv } from "./_env";

async function main() {
  loadEnv();
  // Import after env is loaded so the client picks up TURSO_* vars.
  const { db } = await import("../lib/db");

  const sql = readFileSync(join(process.cwd(), "lib", "schema.sql"), "utf8");

  // Strip `--` line comments first (otherwise a leading comment would hide the
  // statement that follows it), then split into statements on ';'.
  const statements = sql
    .replace(/--[^\n]*/g, "")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  console.log(`Applying ${statements.length} statements…`);
  for (const stmt of statements) {
    try {
      await db.execute(stmt);
    } catch (err) {
      console.error(`Failed on statement:\n${stmt}\n`);
      throw err;
    }
  }
  console.log("Migration complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
