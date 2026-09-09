import { neon, Pool, NeonQueryFunction } from "@neondatabase/serverless";

/**
 * Neon Serverless PostgreSQL Database Client Scaffolding
 *
 * For serverless Next.js API route handlers and Server Actions, HTTP-based queries
 * via `neon()` are recommended due to connection pooling, sub-10ms connection setup,
 * and zero persistent connection overhead.
 *
 * `Pool` is also exported if multi-query transactions are needed.
 */

let cachedSql: NeonQueryFunction<false, false> | null = null;
let cachedPool: Pool | null = null;

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL environment variable is missing. " +
        "Ensure DATABASE_URL is defined in .env.local (development) or your deployment environment variables."
    );
  }
  return url;
}

/**
 * Returns a Neon HTTP SQL client instance.
 * Reuses instance within the serverless function lifecycle.
 */
export function getDb(): NeonQueryFunction<false, false> {
  if (!cachedSql) {
    const url = getDatabaseUrl();
    cachedSql = neon(url, {
      fetchOptions: {
        cache: "no-store",
      },
    });
  }
  return cachedSql;
}

/**
 * Returns a pooled connection instance for transactions or session-level states.
 */
export function getPool(): Pool {
  if (!cachedPool) {
    const url = getDatabaseUrl();
    cachedPool = new Pool({ connectionString: url });
  }
  return cachedPool;
}

/**
 * Default sql tagged-template runner.
 * Automatically delegates to getDb() on invocation.
 */
export const sql: NeonQueryFunction<false, false> = ((...args: Parameters<NeonQueryFunction<false, false>>) => {
  const db = getDb();
  return db(...args);
}) as NeonQueryFunction<false, false>;

export { Pool };
