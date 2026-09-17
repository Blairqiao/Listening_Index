import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local" });
dotenv.config({ path: "spotify.env" });

import { getAccessToken } from "../src/lib/spotify";
import { getDb, isDbConfigured } from "../src/lib/db";

async function testRateLimit() {
  console.log("============================================================");
  console.log("             Spotify API Rate Limit Probe                   ");
  console.log("============================================================\n");

  let trackId = process.argv[2];

  // If no track ID provided, pick one from pending tracks in DB, or fallback
  if (!trackId && isDbConfigured()) {
    try {
      const sql = getDb();
      const rows = await sql`
        SELECT id, name, artist_name 
        FROM tracks 
        WHERE enrichment_status = 'pending' 
        LIMIT 1;
      `;
      if (rows.length > 0) {
        trackId = rows[0].id;
        console.log(`[PROBE TARGET] Using pending track from database: "${rows[0].name}" (${trackId})`);
      }
    } catch {
      // Fallback
    }
  }

  if (!trackId) {
    trackId = "4cOdK2wGLETKBW3PvgPWqT"; // Rick Astley - Never Gonna Give You Up
    console.log(`[PROBE TARGET] Using standard test track: ${trackId}`);
  }

  console.log("[1/2] Obtaining Spotify access token...");
  let token: string;
  try {
    token = await getAccessToken();
    console.log("      ✓ Access token acquired successfully.\n");
  } catch (err: any) {
    console.error("      ✗ Failed to obtain access token:", err.message);
    if (err.status === 429) {
      console.error(`      ⚠️ Spotify Auth endpoint is rate-limited! Retry after ${err.retryAfter ?? "unknown"}s`);
    }
    process.exit(1);
  }

  console.log(`[2/2] Sending GET request to https://api.spotify.com/v1/tracks/${trackId}...`);
  const startTime = Date.now();
  const response = await fetch(`https://api.spotify.com/v1/tracks/${encodeURIComponent(trackId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const latency = Date.now() - startTime;

  console.log(`\n------------------------------------------------------------`);
  console.log(`HTTP Status: ${response.status} ${response.statusText} (${latency}ms)`);
  console.log(`------------------------------------------------------------\n`);

  if (response.status === 200) {
    const data = (await response.json()) as any;
    const trackName = data.name;
    const artistName = data.artists?.[0]?.name || "Unknown";
    const albumName = data.album?.name || "Unknown";

    console.log("  🎉 NOT RATE-LIMITED! The API responded with 200 OK.");
    console.log(`  Track:  ${trackName}`);
    console.log(`  Artist: ${artistName}`);
    console.log(`  Album:  ${albumName}`);
    console.log("\n  You are clear to make calls to Spotify Web API.");

    // Check if a cooldown is recorded in DB and offer to clear it
    if (isDbConfigured()) {
      const sql = getDb();
      const cooldowns = await sql`
        SELECT * FROM daily_api_usage 
        WHERE cooldown_until > NOW()
        ORDER BY cooldown_until DESC
        LIMIT 1;
      `;
      if (cooldowns.length > 0) {
        console.log(`\n  [NOTICE] Database still has a cooldown recorded until ${cooldowns[0].cooldown_until}.`);
        await sql`UPDATE daily_api_usage SET cooldown_until = NULL, cooldown_reason = NULL WHERE cooldown_until > NOW();`;
        console.log("  ✓ Cleared outdated cooldown from database. Ingestion/enrichment can resume immediately!");
      }
    }
  } else if (response.status === 429) {
    const retryAfter = response.headers.get("Retry-After");
    const retrySeconds = retryAfter ? parseInt(retryAfter, 10) : undefined;
    console.log("  ⚠️ RATE-LIMITED (HTTP 429)!");
    if (retrySeconds) {
      const resetTime = new Date(Date.now() + retrySeconds * 1000);
      console.log(`  Retry-After: ${retrySeconds} seconds`);
      console.log(`  Estimated reset time: ${resetTime.toISOString()} (${resetTime.toLocaleTimeString()})`);
    } else {
      console.log("  No Retry-After header was provided by Spotify.");
    }
    const bodyText = await response.text();
    console.log(`  Response: ${bodyText}`);
  } else if (response.status === 404) {
    console.log(`  Track ${trackId} returned 404 Not Found (delisted or invalid ID).`);
    console.log("  However, the API itself responded normally (NOT rate-limited).");
  } else {
    const bodyText = await response.text();
    console.log(`  API Error: ${bodyText}`);
  }

  console.log("\n============================================================\n");
}

testRateLimit().catch((err) => {
  console.error("Test script failed unexpectedly:", err);
  process.exit(1);
});
