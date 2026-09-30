/**
 * The owner's own Spotify connection, stored in the database.
 *
 * The dashboard reads the owner's playback and history with a refresh token.
 * That token used to come only from SPOTIFY_REFRESH_TOKEN, which means a
 * terminal script and a hosting dashboard before anything works. Connecting
 * from the settings menu stores it here instead, encrypted exactly like a
 * guest's player token.
 *
 * It shares the guests' table under a reserved id rather than growing a new
 * one. Guest ids are Spotify user ids, which never begin with an underscore,
 * and readGuestSession refuses reserved ids — so no guest session, forged or
 * otherwise, can resolve to this record.
 */

import { isDbConfigured } from "@/lib/db";
import {
  getOwnerPlaybackToken,
  saveOwnerPlaybackToken,
  deleteOwnerPlaybackToken,
} from "@/lib/db/queries/config";

export const OWNER_RECORD_ID = "__owner__";

export interface OwnerCredential {
  displayName: string | null;
  refreshToken: string;
}

/** Storing the owner token needs a configured database. */
export function canStoreOwnerCredential(): boolean {
  return isDbConfigured();
}

export async function getOwnerCredential(): Promise<OwnerCredential | null> {
  if (!canStoreOwnerCredential()) return null;
  try {
    const token = await getOwnerPlaybackToken();
    if (!token) return null;
    return { displayName: null, refreshToken: token };
  } catch {
    return null;
  }
}

export async function saveOwnerCredential(
  refreshToken: string,
  _displayName: string | null
): Promise<void> {
  await saveOwnerPlaybackToken(refreshToken);
}

export async function clearOwnerCredential(): Promise<void> {
  await deleteOwnerPlaybackToken();
}
