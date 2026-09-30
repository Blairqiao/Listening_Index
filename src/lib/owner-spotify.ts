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

import { userRepository } from "@/lib/db/repositories";
import { isBackendConfigured } from "@/lib/db/adapter";
import { decryptToken, encryptToken, getEncryptionKeyConfigured } from "@/lib/user-auth";

export const OWNER_RECORD_ID = "__owner__";

export interface OwnerCredential {
  displayName: string | null;
  refreshToken: string;
}

/** Storing the owner token needs somewhere to put it and a key to seal it. */
export function canStoreOwnerCredential(): boolean {
  return isBackendConfigured() && getEncryptionKeyConfigured();
}

export async function getOwnerCredential(): Promise<OwnerCredential | null> {
  if (!canStoreOwnerCredential()) return null;
  try {
    const record = await userRepository().getUser(OWNER_RECORD_ID);
    if (!record) return null;
    const refreshToken = decryptToken(record.encryptedRefreshToken);
    // Undecryptable means the key changed: treat as not connected rather
    // than sending garbage to Spotify.
    if (!refreshToken) return null;
    return { displayName: record.displayName, refreshToken };
  } catch {
    return null;
  }
}

export async function saveOwnerCredential(
  refreshToken: string,
  displayName: string | null
): Promise<void> {
  await userRepository().upsertUser({
    id: OWNER_RECORD_ID,
    displayName,
    encryptedRefreshToken: encryptToken(refreshToken),
  });
}

export async function clearOwnerCredential(): Promise<void> {
  await userRepository().deleteUser(OWNER_RECORD_ID);
}
