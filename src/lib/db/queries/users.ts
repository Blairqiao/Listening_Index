/**
 * Guest player accounts, Postgres implementation.
 *
 * Separate from the listening tables on purpose. `plays`, `tracks` and
 * `artists` are the owner's published history; this table holds other
 * people's credentials. Keeping them apart means a query that joins the
 * listening data can never accidentally select a token.
 */

import { getDb, isDbConfigured } from "../index";
import type { GuestUser, UserRepository } from "../adapter";

let ensured = false;

/**
 * Created on demand rather than in schema.ts, so a deployment that never
 * enables guest sign-in never grows the table.
 */
async function ensureUsersTable(): Promise<void> {
  if (ensured) return;
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS player_users (
      id TEXT PRIMARY KEY,
      display_name TEXT,
      encrypted_refresh_token TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  ensured = true;
}

export const postgresUserRepository: UserRepository = {
  async getUser(id: string): Promise<GuestUser | null> {
    if (!isDbConfigured()) return null;
    await ensureUsersTable();
    const sql = getDb();
    const rows = (await sql`
      SELECT id, display_name, encrypted_refresh_token
      FROM player_users
      WHERE id = ${id}
      LIMIT 1;
    `) as Array<{
      id: string;
      display_name: string | null;
      encrypted_refresh_token: string;
    }>;
    if (!rows?.length) return null;
    return {
      id: rows[0].id,
      displayName: rows[0].display_name,
      encryptedRefreshToken: rows[0].encrypted_refresh_token,
    };
  },

  async upsertUser(user: GuestUser): Promise<void> {
    if (!isDbConfigured()) return;
    await ensureUsersTable();
    const sql = getDb();
    await sql`
      INSERT INTO player_users (id, display_name, encrypted_refresh_token, updated_at)
      VALUES (${user.id}, ${user.displayName}, ${user.encryptedRefreshToken}, NOW())
      ON CONFLICT (id) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        encrypted_refresh_token = EXCLUDED.encrypted_refresh_token,
        updated_at = NOW();
    `;
  },

  async deleteUser(id: string): Promise<void> {
    if (!isDbConfigured()) return;
    await ensureUsersTable();
    const sql = getDb();
    // Signing out discards the stored credential rather than merely clearing
    // the cookie, so "sign out" means this app no longer holds their token.
    await sql`DELETE FROM player_users WHERE id = ${id};`;
  },
};
