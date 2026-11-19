/**
 * Opt-in PostgreSQL access for tests. `scrub-env.ts` removes the app's own connection
 * variables, so these tests run only when `TEST_DATABASE_URL` names a separate database.
 */
const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim() ?? "";

export const hasTestDb = testDatabaseUrl.length > 0;

/** Pass as the options argument of a test that needs PostgreSQL. */
export const dbTest = { skip: hasTestDb ? false : "TEST_DATABASE_URL is not set" };

export const TEST_ADMIN_PASSWORD = "test-admin-password";

let ready: Promise<void> | null = null;

/** Points the app's database client at the test database and brings its schema up to date. */
export function useTestDatabase(): Promise<void> {
  if (!hasTestDb) throw new Error("useTestDatabase() called without TEST_DATABASE_URL");
  if (!ready) {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.ADMIN_PASSWORD = TEST_ADMIN_PASSWORD;
    ready = (async () => {
      // A Neon branch copies the owner's Spotify credential. Stub it out so no test
      // can call Spotify or rotate the real refresh token.
      const { __setMockOwnerCredentialForTesting } = await import("../../src/lib/owner-spotify");
      __setMockOwnerCredentialForTesting(null);
      const { migrateSchema } = await import("../../src/lib/db/queries/schema");
      await migrateSchema();
    })();
  }
  return ready;
}
