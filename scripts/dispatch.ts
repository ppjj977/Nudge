import { loadEnv } from "./_env";

async function main() {
  loadEnv();
  const { runDispatch } = await import("../lib/dispatch");
  const result = await runDispatch();
  console.log(`Dispatch: ${JSON.stringify(result)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
