/**
 * Guest player accounts, MongoDB implementation.
 *
 * Next to the Postgres version, the contrast is instructive:
 *
 *   CREATE TABLE IF NOT EXISTS player_users (...)
 *     ->  nothing. The collection appears on first write.
 *
 *   INSERT ... ON CONFLICT (id) DO UPDATE SET ...
 *     ->  updateOne({ _id }, { $set }, { upsert: true })
 *
 *   DELETE FROM player_users WHERE id = $1
 *     ->  deleteOne({ _id })
 *
 * The Spotify user id goes in _id, so uniqueness is enforced by the primary
 * key exactly as it is in Postgres — no separate index needed.
 */

import { getMongoDb } from "./index";
import type { GuestUser, UserRepository } from "../adapter";

const COLLECTION = "player_users";

interface UserDoc {
  _id: string;
  displayName: string | null;
  encryptedRefreshToken: string;
  updatedAt: Date;
}

export const mongoUserRepository: UserRepository = {
  async getUser(id: string): Promise<GuestUser | null> {
    const db = await getMongoDb();
    const doc = (await db
      .collection(COLLECTION)
      .findOne({ _id: id as never })) as UserDoc | null;
    if (!doc?.encryptedRefreshToken) return null;
    return {
      id: doc._id,
      displayName: doc.displayName ?? null,
      encryptedRefreshToken: doc.encryptedRefreshToken,
    };
  },

  async upsertUser(user: GuestUser): Promise<void> {
    const db = await getMongoDb();
    await db.collection(COLLECTION).updateOne(
      { _id: user.id as never },
      {
        $set: {
          displayName: user.displayName,
          encryptedRefreshToken: user.encryptedRefreshToken,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );
  },

  async deleteUser(id: string): Promise<void> {
    const db = await getMongoDb();
    await db.collection(COLLECTION).deleteOne({ _id: id as never });
  },
};
