/**
 * MongoDB connection for a serverless runtime.
 *
 * Postgres here talks over HTTP via `neon()`, so there is no connection to
 * keep alive. The MongoDB driver is the opposite: it opens real TCP sockets
 * and expects a long-lived client with its own pool.
 *
 * In a serverless function that is a trap. A new MongoClient per invocation
 * means a new TCP handshake plus TLS plus auth on every request, and under
 * load it exhausts the cluster's connection limit. The fix is to create the
 * client once and reuse it: a warm function instance keeps the pool, and a
 * cold one pays the handshake a single time.
 *
 * The global cache matters in development too — Next.js hot reload re-evaluates
 * modules on every edit, so a module-level variable alone would leak a new
 * client per save until the cluster refused connections.
 */

import { MongoClient, Db } from "mongodb";

const DB_NAME = process.env.MONGODB_DB || "listening_index";

declare global {
  // eslint-disable-next-line no-var
  var __listeningIndexMongo: Promise<MongoClient> | undefined;
}

export function getMongoUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri || !uri.trim()) {
    throw new Error(
      "MONGODB_URI is not configured. Set it in .env.local (development) " +
        "or your deployment environment variables."
    );
  }
  return uri;
}

function createClient(): Promise<MongoClient> {
  return new MongoClient(getMongoUri(), {
    // Serverless invocations are short; failing fast beats hanging a request.
    serverSelectionTimeoutMS: 8000,
    // One instance handles few concurrent queries, so a large pool is waste.
    maxPoolSize: 10,
  }).connect();
}

export function getMongoClient(): Promise<MongoClient> {
  if (process.env.NODE_ENV === "development") {
    // Survives hot reload, which would otherwise leak a client per edit.
    if (!global.__listeningIndexMongo) {
      global.__listeningIndexMongo = createClient();
    }
    return global.__listeningIndexMongo;
  }
  if (!cachedClient) {
    cachedClient = createClient();
  }
  return cachedClient;
}

let cachedClient: Promise<MongoClient> | null = null;

export async function getMongoDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(DB_NAME);
}

/**
 * Creates the indexes the app relies on.
 *
 * This is the counterpart to schema.ts, and the contrast is the point:
 * MongoDB does not need CREATE TABLE, because a collection springs into
 * existence on first write and documents carry their own shape. What it does
 * need is indexes — and critically the unique one, which is the only thing
 * that makes re-syncing the same plays idempotent.
 *
 * createIndex is idempotent, so calling this on every cold start is safe.
 */
export async function ensureMongoIndexes(): Promise<void> {
  const db = await getMongoDb();

  // The direct equivalent of the Postgres
  // CONSTRAINT plays_played_at_track_id_key UNIQUE (played_at, track_id).
  // Without it, every 30-minute sync would duplicate the last 50 plays.
  await db
    .collection("plays")
    .createIndex({ playedAt: 1, trackId: 1 }, { unique: true, name: "plays_played_at_track_id" });

  // Stream Log reads newest-first; this is what keeps that a range scan
  // rather than a full collection sort.
  await db.collection("plays").createIndex({ playedAt: -1 }, { name: "plays_played_at_desc" });

  await db
    .collection("tracks")
    .createIndex({ enrichmentStatus: 1 }, { name: "tracks_enrichment_status" });
}
