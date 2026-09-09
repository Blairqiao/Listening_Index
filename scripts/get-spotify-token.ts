import http from "node:http";
import { exec } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import crypto from "node:crypto";
import dotenv from "dotenv";

// Load existing environment files if available
dotenv.config();
dotenv.config({ path: ".env.local" });
dotenv.config({ path: "spotify.env" });

const PORT = 8888;
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`;
const SCOPES = [
  "user-read-recently-played",
  "user-read-playback-state",
  "user-read-currently-playing",
].join(" ");

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    })
  );
}

function openBrowser(url: string) {
  const start =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
      ? "start"
      : "xdg-open";
  exec(`${start} "${url}"`, (err) => {
    if (err) {
      console.log(`\n👉 Could not open browser automatically. Please open this URL:\n${url}\n`);
    }
  });
}

function updateEnvFile(filePath: string, updates: Record<string, string>) {
  let content = "";
  if (fs.existsSync(filePath)) {
    content = fs.readFileSync(filePath, "utf-8");
  }

  const lines = content.split("\n");
  const keysToUpdate = new Set(Object.keys(updates));
  const newLines: string[] = [];

  for (const line of lines) {
    const match = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (match && keysToUpdate.has(match[1])) {
      const key = match[1];
      newLines.push(`${key}=${updates[key]}`);
      keysToUpdate.delete(key);
    } else {
      newLines.push(line);
    }
  }

  for (const key of keysToUpdate) {
    newLines.push(`${key}=${updates[key]}`);
  }

  fs.writeFileSync(filePath, newLines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n", "utf-8");
}

async function main() {
  console.log("============================================================");
  console.log("          Spotify OAuth Refresh Token Generator             ");
  console.log("============================================================\n");

  let clientId = process.env.SPOTIFY_CLIENT_ID;
  let clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId) {
    console.log("Create an app at https://developer.spotify.com/dashboard if you haven't yet.");
    console.log(`Ensure Redirect URI is set to: ${REDIRECT_URI} or http://localhost:${PORT}/callback\n`);
    clientId = await askQuestion("Enter your Spotify Client ID: ");
  }

  if (!clientSecret) {
    clientSecret = await askQuestion("Enter your Spotify Client Secret: ");
  }

  if (!clientId || !clientSecret) {
    console.error("Client ID and Client Secret are required. Exiting.");
    process.exit(1);
  }

  const state = crypto.randomBytes(16).toString("hex");

  const server = http.createServer(async (req, res) => {
    try {
      if (!req.url || !req.url.startsWith("/callback")) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
        return;
      }

      const urlObj = new URL(req.url, `http://127.0.0.1:${PORT}`);
      const code = urlObj.searchParams.get("code");
      const error = urlObj.searchParams.get("error");
      const returnedState = urlObj.searchParams.get("state");

      if (error) {
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`<h2>Authorization Failed: ${error}</h2><p>You can close this window.</p>`);
        console.error(`\nSpotify returned an error: ${error}`);
        server.close();
        process.exit(1);
      }

      if (!code || returnedState !== state) {
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<h2>Invalid callback parameters or state mismatch.</h2>");
        server.close();
        process.exit(1);
      }

      // Exchange authorization code for tokens
      const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
      const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: REDIRECT_URI,
        }).toString(),
      });

      if (!tokenResponse.ok) {
        const errBody = await tokenResponse.text();
        res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`<h2>Failed to exchange token</h2><pre>${errBody}</pre>`);
        console.error("\nToken exchange failed:", errBody);
        server.close();
        process.exit(1);
      }

      const tokenData = (await tokenResponse.json()) as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
        scope: string;
      };

      const refreshToken = tokenData.refresh_token;

      if (!refreshToken) {
        res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<h2>Spotify did not return a refresh token.</h2>");
        console.error("\nNo refresh token returned. Did you grant permissions?");
        server.close();
        process.exit(1);
      }

      // Success HTML response
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Spotify Connected</title>
            <style>
              body { background: #080808; color: #EDEDE8; font-family: monospace; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
              .card { background: #141413; border: 1px solid #26261F; padding: 32px 48px; border-radius: 8px; text-align: center; }
              h2 { color: #60ff47; margin-bottom: 8px; }
              p { color: #A8A8A2; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="card">
              <h2>Spotify Authorization Successful!</h2>
              <p>Your refresh token has been captured. You can close this tab and return to your terminal.</p>
            </div>
          </body>
        </html>
      `);

      // Update .env.local
      const envLocalPath = path.resolve(process.cwd(), ".env.local");
      updateEnvFile(envLocalPath, {
        SPOTIFY_CLIENT_ID: clientId,
        SPOTIFY_CLIENT_SECRET: clientSecret,
        SPOTIFY_REFRESH_TOKEN: refreshToken,
      });

      console.log("\n============================================================");
      console.log("          SUCCESS! Spotify Refresh Token Acquired!            ");
      console.log("============================================================\n");
      console.log(`Automatically updated: ${envLocalPath}`);
      console.log("\nVariables to copy into Vercel Environment Variables:\n");
      console.log(`SPOTIFY_CLIENT_ID=${clientId}`);
      console.log(`SPOTIFY_CLIENT_SECRET=${clientSecret}`);
      console.log(`SPOTIFY_REFRESH_TOKEN=${refreshToken}`);
      console.log("\n============================================================\n");

      server.close();
      process.exit(0);
    } catch (err) {
      console.error("\nError handling callback:", err);
      server.close();
      process.exit(1);
    }
  });

  server.listen(PORT, "127.0.0.1", () => {
    const authUrl = new URL("https://accounts.spotify.com/authorize");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.set("scope", SCOPES);
    authUrl.searchParams.set("state", state);

    console.log(`\nListening for Spotify callback on ${REDIRECT_URI}...`);
    console.log(`Opening Spotify authorization page in your default browser...`);
    openBrowser(authUrl.toString());
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
