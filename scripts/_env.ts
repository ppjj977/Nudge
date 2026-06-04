import { existsSync } from "node:fs";

/**
 * Load .env / .env.local for standalone scripts (Next loads these itself, but
 * tsx-run scripts do not). Uses Node's built-in loader, no dependency.
 */
export function loadEnv(): void {
  for (const file of [".env", ".env.local"]) {
    if (existsSync(file)) {
      try {
        process.loadEnvFile(file);
      } catch {
        /* ignore */
      }
    }
  }
}
