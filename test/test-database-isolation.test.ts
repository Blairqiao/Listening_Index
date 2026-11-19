import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { isDbConfigured } from "../src/lib/db";
import { hasTestDb } from "./helpers/test-db";

const testDir = __dirname;

test("npm test preloads the env scrub, so the app database is unreachable", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(testDir, "..", "package.json"), "utf-8"));
  assert.match(pkg.scripts.test, /--import \.\/test\/helpers\/scrub-env\.ts/);
  if (!hasTestDb) {
    assert.equal(process.env.DATABASE_URL, undefined);
    assert.equal(process.env.POSTGRES_URL, undefined);
    assert.equal(isDbConfigured(), false);
  }
});

test("no test file loads .env.local or dotenv", () => {
  const offenders = fs
    .readdirSync(testDir)
    .filter((file) => file.endsWith(".test.ts") && file !== path.basename(__filename))
    .filter((file) => /\.env\.local|dotenv/.test(fs.readFileSync(path.join(testDir, file), "utf-8")));
  assert.deepEqual(offenders, []);
});
