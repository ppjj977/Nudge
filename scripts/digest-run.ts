import { loadEnv } from "./_env";

async function main() {
  loadEnv();
  const { runDigest } = await import("../lib/dispatch");
  const result = await runDigest();
  console.log(`Digest: ${JSON.stringify(result)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
