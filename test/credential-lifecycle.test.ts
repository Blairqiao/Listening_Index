import test from 'node:test';
import assert from 'node:assert/strict';
import { __setMockOwnerCredentialForTesting } from '../src/lib/owner-spotify';
import { getAccessToken, resetSpotifyTokenCache } from '../src/lib/spotify';
import { closePopup } from '../src/lib/popup-response';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

for (const replacement of [null, { refreshToken: 'replacement', displayName: 'New owner' }]) {
  test(`an overlapping ${replacement ? 'replacement' : 'disconnect'} rejects a stale refresh completion`, async () => {
    const originalFetch = globalThis.fetch;
    process.env.SPOTIFY_CLIENT_ID = 'mock-client';
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
    resetSpotifyTokenCache();
    __setMockOwnerCredentialForTesting({ refreshToken: 'old', displayName: 'Old owner' });
    const response = deferred<Response>();
    const started = deferred<void>();
    globalThis.fetch = async () => { started.resolve(); return response.promise; };
    try {
      const token = getAccessToken();
      await started.promise;
      __setMockOwnerCredentialForTesting(replacement);
      response.resolve(Response.json({ access_token: 'stale-access', expires_in: 3600 }));
      await assert.rejects(token, /connection changed/i);
    } finally {
      globalThis.fetch = originalFetch;
      __setMockOwnerCredentialForTesting(undefined);
      resetSpotifyTokenCache();
    }
  });
}

test('cached access tokens are checked against the authoritative connection before reuse', async () => {
  const originalFetch = globalThis.fetch;
  process.env.SPOTIFY_CLIENT_ID = 'mock-client';
  resetSpotifyTokenCache();
  __setMockOwnerCredentialForTesting({ refreshToken: 'old', displayName: null });
  let requests = 0;
  globalThis.fetch = async () => Response.json({ access_token: `access-${++requests}`, expires_in: 3600 });
  try {
    assert.equal(await getAccessToken(), 'access-1');
    __setMockOwnerCredentialForTesting({ refreshToken: 'new', displayName: null });
    assert.equal(await getAccessToken(), 'access-2');
    __setMockOwnerCredentialForTesting(null);
    await assert.rejects(getAccessToken(), /not connected/i);
  } finally {
    globalThis.fetch = originalFetch;
    __setMockOwnerCredentialForTesting(undefined);
    resetSpotifyTokenCache();
  }
});

test('popup responses pin their message to the opener origin and retain direct fallback', async () => {
  const html = await closePopup('https://preview.example', true, null, 'spotify-player-auth').text();
  assert.match(html, /postMessage\([^\n]+, "https:\/\/preview.example"\)/);
  assert.doesNotMatch(html, /postMessage\([^\n]+, "\*"\)/);
  assert.match(html, /else location.replace\("\/"\)/);
});

test('popup receiver accepts only its popup, exact callback origin, and a boolean result', async () => {
  const { beginLoginPopup, AUTH_MESSAGE } = await import('../src/lib/spotify-auth');
  const originalWindow = globalThis.window;
  const popup = { closed: false };
  let listener: ((event: unknown) => void) | undefined;
  const fakeWindow = {
    location: { origin: 'https://preview.example' }, screenX: 0, screenY: 0, outerWidth: 1000, outerHeight: 900,
    open: () => popup,
    addEventListener: (_type: string, fn: (event: unknown) => void) => { listener = fn; },
    removeEventListener: () => { listener = undefined; },
  };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: fakeWindow });
  try {
    const result = beginLoginPopup();
    const emit = (origin: string, source: object, ok: unknown) => listener?.({ origin, source, data: { type: AUTH_MESSAGE, ok } });
    emit('http://localhost:8888', popup, true);
    assert.ok(listener, 'unrelated loopback origin must be ignored');
    emit('https://preview.example', {}, true);
    assert.ok(listener, 'another same-origin window must be ignored');
    emit('https://preview.example', popup, 'true');
    assert.ok(listener, 'malformed result must be ignored');
    emit('https://preview.example', popup, true);
    assert.equal(await result, true);
  } finally {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
  }
});
