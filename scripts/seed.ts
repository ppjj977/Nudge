import { loadEnv } from "./_env";

async function main() {
  loadEnv();
  const { getOrCreateDefaultUser } = await import("../lib/users");

  const user = await getOrCreateDefaultUser();
  console.log("Default user ready:");
  console.log(`  id:       ${user.id}`);
  console.log(`  email:    ${user.email}`);
  console.log(`  timezone: ${user.timezone}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
