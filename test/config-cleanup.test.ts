import assert from "node:assert";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { siteConfig } from "../src/config";
import { generateConfigTsCode, DEFAULT_SITE_CONFIG } from "../src/lib/config-utils";

test("src/config.ts does not export spotifyClientId", () => {
  assert.strictEqual(
    "spotifyClientId" in siteConfig,
    false,
    "siteConfig should not contain spotifyClientId"
  );
});

test("generateConfigTsCode does not output spotifyClientId", () => {
  const code = generateConfigTsCode(DEFAULT_SITE_CONFIG);
  assert.strictEqual(
    code.includes("spotifyClientId"),
    false,
    "Generated config code should not contain spotifyClientId"
  );
});

test("CustomizationModal source code does not contain client secret/id paste prompt or redirect URI box", () => {
  const modalPath = path.join(process.cwd(), "src/components/CustomizationModal.tsx");
  const modalSource = fs.readFileSync(modalPath, "utf-8");

  assert.strictEqual(
    modalSource.includes("SPOTIFY CLIENT ID"),
    false,
    "CustomizationModal should not prompt for SPOTIFY CLIENT ID"
  );
  assert.strictEqual(
    modalSource.includes("Paste from developer.spotify.com"),
    false,
    "CustomizationModal should not tell user to paste from developer.spotify.com"
  );
  assert.strictEqual(
    modalSource.includes("Register this redirect URI in the same Spotify"),
    false,
    "CustomizationModal should not contain redirect URI prompt"
  );
  assert.strictEqual(
    modalSource.includes("getRedirectUri"),
    false,
    "CustomizationModal should not import or call getRedirectUri"
  );
});
