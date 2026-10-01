import test from "node:test";
import assert from "node:assert/strict";
import { getRedirectUri } from "../src/lib/spotify-auth";

test("getRedirectUri - returns http://127.0.0.1:8888/callback for localhost origins", () => {
  const originalWindow = globalThis.window;
  const originalEnv = process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI;
  delete process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI;

  try {
    // 1. Localhost port 3000
    // @ts-expect-error test mock
    globalThis.window = { location: { origin: "http://localhost:3000" } };
    assert.equal(getRedirectUri(), "http://127.0.0.1:8888/callback");

    // 2. Localhost port 8888
    // @ts-expect-error test mock
    globalThis.window = { location: { origin: "http://localhost:8888" } };
    assert.equal(getRedirectUri(), "http://127.0.0.1:8888/callback");

    // 3. 127.0.0.1 port 3000
    // @ts-expect-error test mock
    globalThis.window = { location: { origin: "http://127.0.0.1:3000" } };
    assert.equal(getRedirectUri(), "http://127.0.0.1:8888/callback");

    // 4. 127.0.0.1 port 8888
    // @ts-expect-error test mock
    globalThis.window = { location: { origin: "http://127.0.0.1:8888" } };
    assert.equal(getRedirectUri(), "http://127.0.0.1:8888/callback");

    // 5. Production deployed domain (non-loopback)
    // @ts-expect-error test mock
    globalThis.window = { location: { origin: "https://listening.example.com" } };
    assert.equal(getRedirectUri(), "https://listening.example.com/callback");

    // 6. Explicit env var override
    process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI = "https://custom.domain.com/callback";
    assert.equal(getRedirectUri(), "https://custom.domain.com/callback");
  } finally {
    globalThis.window = originalWindow;
    if (originalEnv) {
      process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI = originalEnv;
    } else {
      delete process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI;
    }
  }
});
