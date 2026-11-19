import fs from "node:fs";
import path from "node:path";

/**
 * Preloaded by `npm test`. No test may reach the database configured for the app, so
 * the app's connection variables are removed before any test file loads. Tests that
 * need PostgreSQL opt in through `TEST_DATABASE_URL` (see `test-db.ts`).
 */
const APP_DATABASE_KEYS = ["DATABASE_URL", "POSTGRES_URL"] as const;

function readEnvFileValues(file: string): string[] {
  if (!fs.existsSync(file)) return [];
  const values: string[] = [];
  for (const line of fs.readFileSync(file, "utf-8").split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?(DATABASE_URL|POSTGRES_URL)\s*=\s*(.*)$/);
    if (match) values.push(match[2].trim().replace(/^(['"])(.*)\1$/, "$2"));
  }
  return values;
}

const testUrl = process.env.TEST_DATABASE_URL?.trim();
if (testUrl) {
  const root = path.resolve(__dirname, "..", "..");
  const appUrls = [
    ...APP_DATABASE_KEYS.map((key) => process.env[key]?.trim()),
    ...readEnvFileValues(path.join(root, ".env")),
    ...readEnvFileValues(path.join(root, ".env.local")),
  ].filter(Boolean);
  if (appUrls.includes(testUrl)) {
    throw new Error(
      "TEST_DATABASE_URL points at the application database. Use a separate database or Neon branch."
    );
  }
}

for (const key of APP_DATABASE_KEYS) delete process.env[key];
