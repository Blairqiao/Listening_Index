import test from 'node:test';
import assert from 'node:assert/strict';
import { neonConfig } from '@neondatabase/serverless';
import { NextRequest } from 'next/server';
import { createSessionToken, ADMIN_COOKIE_NAME } from '../src/lib/admin-auth';
import { GET as login } from '../src/app/api/player/login/route';
import { GET as callback } from '../src/app/callback/route';
import { deleteOwnerPlaybackToken } from '../src/lib/db/queries/config';
import vm from 'node:vm';
import { challengeFor } from '../src/lib/user-auth';
import { beginLoginPopup } from '../src/lib/spotify-auth';
import { getSessionCookieHeader, isAuthorizedAdminRequest } from '../src/lib/admin-auth';
import { sealOwnerAuthorization } from '../src/lib/user-auth';

process.env.DATABASE_URL = 'postgresql://mock:mock@secondary.example/mock';
process.env.ADMIN_PASSWORD = 'test-admin-secret-password-123';
process.env.SPOTIFY_CLIENT_ID = 'mock-client';
delete process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI;

let nonce: string | null = null;
let revision = '4';
let writes = 0;
let persisted: { token: string; name: string; profileUrl: string; expectedRevision: string; revision: string } | null = null;
const queries: string[] = [];
function result(row?: Record<string, string | null>) {
  return Response.json({ fields: Object.keys(row ?? {}).map(name => ({ name, dataTypeID: 25 })), rows: row ? [Object.values(row)] : [] });
}
neonConfig.fetchFunction = async (_url: unknown, init?: RequestInit) => {
  const { query, params } = JSON.parse(String(init?.body));
  queries.push(query);
  if (query.includes('SET owner_playback_token = NULL')) {
    revision = String(Number(revision) + 1);
    nonce = null;
    return result();
  }
  if (query.includes('owner_oauth_nonce') && query.includes('INSERT INTO')) {
    nonce = params.find((value: string) => /^[a-f0-9]{64}$/.test(value));
    return result({ owner_token_revision: revision });
  }
  if (query.includes('owner_oauth_nonce = NULL') && query.includes('RETURNING') && !query.includes('owner_playback_token =')) {
    assert.match(query, /owner_oauth_nonce = \$/);
    const matches = params.includes(nonce) && params.includes(revision);
    nonce = null;
    return result(matches ? { owner_token_revision: revision } : undefined);
  }
  if (query.includes('owner_playback_token =') && query.includes('RETURNING')) {
    assert.match(query, /owner_token_revision = \$\d+::bigint/);
    if (!params.includes(revision)) return result();
    revision = String(Number(revision) + 1);
    writes++;
    persisted = { token: params[0], name: params[1], profileUrl: params[2], expectedRevision: params[3], revision };
    return result({ owner_token_revision: revision });
  }
  return result();
};

class BrowserCookies {
  entries = new Map<string, { host: string; name: string; value: string; path: string; secure: boolean; httpOnly: boolean; sameSite: string }>();
  apply(url: string, header: string) {
    const [pair, ...attributes] = header.split(/;\s*/);
    const split = pair.indexOf('=');
    const name = pair.slice(0, split);
    const value = pair.slice(split + 1);
    const host = new URL(url).hostname;
    const attr = (label: string) => attributes.find(attribute => attribute.toLowerCase().startsWith(label.toLowerCase() + '='))?.split('=')[1];
    const path = attr('Path') || '/';
    const key = `${host}:${path}:${name}`;
    if (attr('Max-Age') === '0') this.entries.delete(key);
    else this.entries.set(key, { host, name, value, path, secure: attributes.includes('Secure'), httpOnly: attributes.includes('HttpOnly'), sameSite: attr('SameSite') || '' });
  }
  forRequest(url: string) {
    const target = new URL(url);
    return [...this.entries.values()].filter(cookie => cookie.host === target.hostname && target.pathname.startsWith(cookie.path) && (!cookie.secure || target.protocol === 'https:'))
      .map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
  }
}

for (const origin of ['http://127.0.0.1:8888', 'http://localhost:8888', 'https://preview.example']) {
  test(`OAuth round trip preserves ${origin} with executed popup and authenticated direct returns`, async () => {
    const originalFetch = globalThis.fetch;
    const originalWindow = globalThis.window;
    const originalNodeEnv = process.env.NODE_ENV;
    Object.assign(process.env, { NODE_ENV: origin.startsWith('https:') ? 'production' : 'development' });
    const jar = new BrowserCookies();
    const adminCookie = getSessionCookieHeader(createSessionToken());
    jar.apply(origin, adminCookie);
    const revisionBefore = revision;
    const res = await login(new NextRequest(`${origin}/api/player/login`, { headers: { cookie: jar.forRequest(`${origin}/api/player/login`), host: new URL(origin).host } }));
    assert.equal(res.status, 307);
    for (const cookie of res.headers.getSetCookie()) jar.apply(`${origin}/api/player/login`, cookie);
    for (const cookie of jar.entries.values()) {
      assert.equal(cookie.path, '/');
      assert.equal(cookie.httpOnly, true);
      assert.equal(cookie.sameSite, 'Lax');
      assert.equal(cookie.secure, origin.startsWith('https:'));
    }
    assert.equal(jar.forRequest(`${origin}/different/path`).includes(ADMIN_COOKIE_NAME), true);
    const authorization = new URL(res.headers.get('location')!);
    const state = authorization.searchParams.get('state');
    assert.ok(state, 'login must issue sealed OAuth state');
    assert.ok(!state.includes('mock-client'));
    const redirectUri = authorization.searchParams.get('redirect_uri')!;
    assert.equal(redirectUri, `${origin.replace('localhost', '127.0.0.1')}/callback`);
    const verifier = [...jar.entries.values()].find(cookie => cookie.name === 'player_spotify_pkce')!.value;
    assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(authorization.searchParams.get('code_challenge'), challengeFor(verifier));
    assert.equal(authorization.searchParams.get('client_id'), 'mock-client');
    assert.equal(authorization.searchParams.get('response_type'), 'code');
    const callbackCookies = jar.forRequest(redirectUri);
    if (origin.includes('localhost')) {
      assert.equal(callbackCookies, '');
    } else {
      assert.ok(callbackCookies.includes(`${ADMIN_COOKIE_NAME}=`));
      assert.ok(callbackCookies.includes(`player_spotify_pkce=${verifier}`));
    }
    let exchanges = 0;
    globalThis.fetch = async (url, init) => {
      if (String(url).includes('/api/token')) {
        exchanges++;
        const body = new URLSearchParams(String(init?.body));
        assert.equal(body.get('code_verifier'), verifier);
        assert.equal(body.get('redirect_uri'), redirectUri);
        assert.equal(body.get('code'), 'valid-code');
        assert.equal(body.get('grant_type'), 'authorization_code');
        const headers = init?.headers as Record<string, string>;
        const basic = headers.Authorization;
        if (process.env.SPOTIFY_CLIENT_SECRET) assert.equal(basic, `Basic ${Buffer.from(`mock-client:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`);
        else assert.equal(body.get('client_id'), 'mock-client');
        return Response.json({ access_token: 'new-access', refresh_token: 'provider-refresh' });
      }
      assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer new-access');
      return Response.json({ display_name: 'Provider owner', id: 'provider-owner', external_urls: { spotify: 'https://open.spotify.com/user/provider-owner' } });
    };
    try {
      const callbackUrl = `${redirectUri}?code=valid-code&state=${encodeURIComponent(state)}`;
      const completion = await callback(new NextRequest(callbackUrl, { headers: { host: new URL(redirectUri).host, cookie: callbackCookies } }));
      const html = await completion.text();
      assert.deepEqual(persisted, { token: 'provider-refresh', name: 'Provider owner', profileUrl: 'https://open.spotify.com/user/provider-owner', expectedRevision: revisionBefore, revision: String(Number(revisionBefore) + 1) });
      const deletion = completion.headers.getSetCookie().find(cookie => cookie.startsWith('player_spotify_pkce='))!;
      assert.match(deletion, /Max-Age=0/);
      assert.match(deletion, /Path=\//);
      assert.match(deletion, /HttpOnly/);
      assert.match(deletion, /SameSite=Lax/);
      assert.equal(deletion.includes('; Secure'), origin.startsWith('https:'));
      for (const cookie of completion.headers.getSetCookie()) jar.apply(callbackUrl, cookie);
      assert.equal(jar.forRequest(redirectUri).includes('player_spotify_pkce='), false);
      assert.ok(jar.forRequest(origin).includes(`${ADMIN_COOKIE_NAME}=`), 'original admin cookie survives callback on either host');

      const script = html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)![1];
      const popup = { closed: false };
      let listener: ((event: unknown) => void) | undefined;
      const fakeWindow = {
        location: { origin }, screenX: 0, screenY: 0, outerWidth: 1000, outerHeight: 900,
        open: () => popup,
        addEventListener: (_type: string, fn: (event: unknown) => void) => { listener = fn; },
        removeEventListener: () => { listener = undefined; },
      };
      Object.defineProperty(globalThis, 'window', { configurable: true, value: fakeWindow });
      const received = beginLoginPopup();
      const messages: unknown[] = [];
      vm.runInNewContext(script, {
        window: { opener: { postMessage(payload: unknown, target: string) {
          assert.equal(target, origin);
          messages.push(payload);
          listener?.({ data: payload, source: popup, origin: new URL(redirectUri).origin });
        } }, close() { popup.closed = true; } },
        location: { replace() { throw new Error('popup must close'); } },
      });
      assert.equal(await received, true);
      assert.deepEqual(JSON.parse(JSON.stringify(messages)), [{ type: 'spotify-player-auth', ok: true, message: null }]);
      assert.equal(popup.closed, true);

      let returnedTo = '';
      vm.runInNewContext(script, { window: { opener: null }, location: { replace(url: string) { returnedTo = url; } } });
      assert.equal(returnedTo, `${origin}/`);
      const returnRequest = new NextRequest(returnedTo, { headers: { host: new URL(returnedTo).host, cookie: jar.forRequest(returnedTo) } });
      assert.equal(isAuthorizedAdminRequest(returnRequest), true, 'direct return retains authenticated original admin');
      assert.equal(exchanges, 1);
      const replay = await callback(new NextRequest(callbackUrl, { headers: { host: new URL(redirectUri).host, cookie: jar.forRequest(callbackUrl) } }));
      assert.match(await replay.text(), /expired|already used/i);
      assert.equal(exchanges, 1);
      const tampered = state.slice(0, -4) + 'xxxx';
      const bad = await callback(new NextRequest(`${redirectUri}?code=valid-code&state=${tampered}`, { headers: { host: new URL(redirectUri).host } }));
      assert.match(await bad.text(), /expired|invalid/i);
      assert.equal(exchanges, 1);
    } finally {
      globalThis.fetch = originalFetch;
      Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
      if (originalNodeEnv === undefined) delete (process.env as Record<string, string | undefined>).NODE_ENV;
      else Object.assign(process.env, { NODE_ENV: originalNodeEnv });
    }
  });
}

test('OAuth fixture never makes a real database or Spotify request', () => {
  assert.equal(writes, 3);
  assert.ok(queries.some(query => query.includes('owner_oauth_nonce')));
});


test('expired sealed state is rejected before exchange or persistence', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('expired state must not reach Spotify'); };
  try {
    const state = sealOwnerAuthorization({ verifier: 'private-verifier', nonce: 'expired', revision,
      redirectUri: 'https://preview.example/callback', returnOrigin: 'https://preview.example', expiresAt: Date.now() - 1 });
    const response = await callback(new NextRequest(`https://preview.example/callback?code=unused&state=${state}`));
    assert.match(await response.text(), /expired or invalid/i);
  } finally { globalThis.fetch = originalFetch; }
});

test('disconnect during the code exchange prevents a late callback from restoring credentials', async () => {
  const originalFetch = globalThis.fetch;
  const authCookie = `${ADMIN_COOKIE_NAME}=${createSessionToken()}`;
  const start = await login(new NextRequest('https://preview.example/api/player/login', { headers: { cookie: authCookie } }));
  const authorization = new URL(start.headers.get('location')!);
  const state = authorization.searchParams.get('state')!;
  let release!: (response: Response) => void;
  let started!: () => void;
  const waitForStart = new Promise<void>(resolve => { started = resolve; });
  globalThis.fetch = async (url) => {
    if (String(url).includes('/api/token')) {
      started();
      return new Promise<Response>(resolve => { release = resolve; });
    }
    return Response.json({ id: 'owner' });
  };
  try {
    const writesBefore = writes;
    const completion = callback(new NextRequest(`https://preview.example/callback?code=valid&state=${state}`));
    await waitForStart;
    await deleteOwnerPlaybackToken();
    release(Response.json({ access_token: 'stale-access', refresh_token: 'stale-refresh' }));
    assert.match(await (await completion).text(), /connection changed/i);
    assert.equal(writes, writesBefore);
  } finally { globalThis.fetch = originalFetch; }
});

test('GET /api/player/login without database configuration returns 503 rather than throwing 500', async () => {
  const prevUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const authCookie = `${ADMIN_COOKIE_NAME}=${createSessionToken()}`;
    const res = await login(new NextRequest('https://preview.example/api/player/login', {
      headers: { cookie: authCookie },
    }));
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.match(body.error, /database/i);
  } finally {
    process.env.DATABASE_URL = prevUrl;
  }
});

