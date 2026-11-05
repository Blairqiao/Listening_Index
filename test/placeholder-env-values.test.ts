import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers/load-ts';

// Every module must agree with isConfigured on what counts as a placeholder.
for (const value of ['todo-later', 'TODO', 'Placeholder', '  todo  ']) {
  test(`ADMIN_PASSWORD=${JSON.stringify(value)} counts as not configured everywhere`, () => {
    const previous = process.env.ADMIN_PASSWORD;
    process.env.ADMIN_PASSWORD = value;
    try {
      const adminAuth = loadTs('src/lib/admin-auth.ts');
      assert.equal(adminAuth.isAdminPasswordConfigured(), false, 'admin-auth');

      const userAuth = loadTs('src/lib/user-auth.ts');
      assert.throws(
        () => userAuth.sealOwnerAuthorization({ verifier: 'v', nonce: 'n', revision: 'r', returnOrigin: 'http://127.0.0.1:8888', redirectUri: 'http://127.0.0.1:8888/api/player/callback', expiresAt: Date.now() + 60_000 }),
        /must be configured/,
        'user-auth',
      );
    } finally {
      if (previous === undefined) delete process.env.ADMIN_PASSWORD;
      else process.env.ADMIN_PASSWORD = previous;
    }
  });
}
