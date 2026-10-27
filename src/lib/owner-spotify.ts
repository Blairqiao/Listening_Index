/** Database-backed Spotify credentials for the site owner. */

import { isDbConfigured } from "@/lib/db";
import {
  getOwnerPlaybackCredential,
  rotateOwnerPlaybackToken,
  saveOwnerPlaybackToken,
  deleteOwnerPlaybackToken,
} from "@/lib/db/queries/config";

export interface OwnerCredential {
  displayName: string | null;
  refreshToken: string;
  revision?: string;
}

let mockOwnerCredential: OwnerCredential | null | undefined = undefined;

export function __setMockOwnerCredentialForTesting(
  cred: OwnerCredential | null | undefined
): void {
  mockOwnerCredential = cred;
}

/** Storing the owner token needs a configured database. */
export function canStoreOwnerCredential(): boolean {
  return isDbConfigured();
}

export async function getOwnerCredential(): Promise<OwnerCredential | null> {
  if (mockOwnerCredential !== undefined) {
    return mockOwnerCredential;
  }
  if (!canStoreOwnerCredential()) return null;
  return getOwnerPlaybackCredential();
}

export async function saveOwnerCredential(
  refreshToken: string,
  displayName: string | null = null
): Promise<void> {
  await saveOwnerPlaybackToken(refreshToken, displayName);
}

export async function clearOwnerCredential(): Promise<void> {
  await deleteOwnerPlaybackToken();
}

export async function rotateOwnerCredential(
  credential: OwnerCredential,
  refreshToken: string
): Promise<string | null> {
  return rotateOwnerPlaybackToken(credential.revision ?? "0", credential.refreshToken, refreshToken);
}
