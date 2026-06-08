import { loadEnv } from "./_env";

/**
 * Seed a demo / Play-review account (known login, comped to Pro, sample tasks).
 * Idempotent. DEMO_EMAIL / DEMO_PASSWORD override the defaults.
 *   npx tsx scripts/seed-demo.ts
 *
 * No terminal? The same thing is a one-click button at /admin → "Play-review
 * demo account".
 */
async function main() {
  loadEnv();
  const { seedDemoAccount } = await import("../lib/demo");
  const result = await seedDemoAccount({
    email: process.env.DEMO_EMAIL,
    password: process.env.DEMO_PASSWORD,
  });
  console.log("Demo account ready:");
  console.log(`  email:    ${result.email}`);
  console.log(`  password: ${result.password}`);
  console.log(`  plan:     pro (comp)`);
  console.log(`  ${result.created ? "created new user" : "updated existing user"}, ${result.seededTasks} task(s) seeded`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
