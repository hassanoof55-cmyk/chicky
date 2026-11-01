import test from 'node:test';
import assert from 'node:assert/strict';
import { signInAdmin, getVerifiedAdmin } from '../lib/adminAuth.ts';

// Supabase is the external boundary; authorization decisions remain real code.
function backend({ user = { id: 'admin-1' }, loginError = null, admin = true, rpcError = null } = {}) {
  const calls = [];
  return {
    calls,
    auth: {
      async signInWithPassword(credentials) { calls.push(credentials); return { data: { user }, error: loginError }; },
      async getUser() { return { data: { user }, error: null }; },
      async signOut() { calls.push('signed-out'); return { error: null }; },
    },
    async rpc(name) { assert.equal(name, 'is_chicky_admin'); return { data: admin, error: rpcError }; },
  };
}

test('login requires a server-verified admin role after valid credentials', async () => {
  const client = backend();
  assert.deepEqual(await signInAdmin(client, ' admin@example.com ', 'secret'), { id: 'admin-1' });
  assert.deepEqual(client.calls, [{ email: 'admin@example.com', password: 'secret' }]);
});

test('valid customer credentials do not grant admin access and clear the session', async () => {
  const client = backend({ admin: false });
  await assert.rejects(signInAdmin(client, 'customer@example.com', 'secret'), /غير مسموح/);
  assert.equal(client.calls.at(-1), 'signed-out');
});

test('an authorization outage fails closed and clears the newly opened session', async () => {
  const client = backend({ rpcError: { message: 'unavailable' } });
  await assert.rejects(signInAdmin(client, 'admin@example.com', 'secret'));
  assert.equal(client.calls.at(-1), 'signed-out');
});

test('invalid credentials never open the admin interface', async () => {
  await assert.rejects(signInAdmin(backend({ loginError: { message: 'bad credentials' } }), 'admin@example.com', 'bad'));
});

test('a stored session alone does not establish administrator authorization', async () => {
  assert.equal(await getVerifiedAdmin(backend({ user: null })), null);
  assert.equal(await getVerifiedAdmin(backend({ admin: false })), null);
  assert.deepEqual(await getVerifiedAdmin(backend()), { id: 'admin-1' });
});
