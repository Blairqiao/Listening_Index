/**
 * Connection check for MongoDB.
 *
 * Verifies the URI, credentials and IP allowlist in isolation, so a failure
 * points at Atlas rather than at the app. Run it before wiring the dashboard
 * to a new cluster:
 *
 *   npm run check:mongo
 */

import dotenv from "dotenv";
import { MongoClient } from "mongodb";

// Same order the other scripts use: bare dotenv/config reads only .env,
// and this project keeps local secrets in .env.local.
dotenv.config();
dotenv.config({ path: ".env.local" });

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set. Add it to .env.local first.");
    process.exit(1);
  }
  const dbName = process.env.MONGODB_DB || "listening_index";

  // Redact before printing: the connection string carries the password.
  console.log("Connecting to:", uri.replace(/\/\/([^:]+):[^@]+@/, "//$1:****@"));
  console.log("Database     :", dbName);

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("\n[ok] Connected and authenticated.");

    const db = client.db(dbName);
    const collections = await db.listCollections().toArray();
    console.log(
      collections.length
        ? `[ok] Collections: ${collections.map((c) => c.name).join(", ")}`
        : "[ok] No collections yet — they appear on first write."
    );

    // Prove writes work, then leave nothing behind.
    const probe = db.collection("_connection_check");
    await probe.insertOne({ at: new Date() });
    await probe.drop();
    console.log("[ok] Write and delete succeeded.\n");
    console.log("Ready. Set DB_BACKEND=mongodb and restart the dev server.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("\n[failed]", message, "\n");
    if (/bad auth|authentication failed/i.test(message)) {
      console.error(
        "Authentication failed. Check the username and password in the URI. " +
          "A password containing @ : / or # must be percent-encoded."
      );
    } else if (/ServerSelection|ETIMEDOUT|ENOTFOUND|timed out/i.test(message)) {
      console.error(
        "Could not reach the cluster. Most often the IP allowlist: " +
          "Atlas -> Network Access -> Add IP Address (your current IP for local, " +
          "0.0.0.0/0 for a serverless deployment)."
      );
    }
    process.exitCode = 1;
  } finally {
    await client.close().catch(() => {});
  }
}

void main();
