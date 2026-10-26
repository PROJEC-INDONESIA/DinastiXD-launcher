const assert = require('node:assert/strict');
const test = require('node:test');
const { authenticateEly } = require('../src/ely-auth');

test('Ely.by login sends username and 2FA password only to the official HTTPS endpoint', async () => {
  const originalFetch = global.fetch;
  let request;
  global.fetch = async (url, options) => {
    request = { url, options, payload: JSON.parse(options.body) };
    return new Response(JSON.stringify({
      accessToken: 'session-token',
      selectedProfile: { id: 'profile-id', name: 'player' }
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  try {
    const account = await authenticateEly('player@example.com', 'secret', '123456');
    assert.equal(request.url, 'https://authserver.ely.by/auth/authenticate');
    assert.equal(request.options.method, 'POST');
    assert.equal(request.payload.username, 'player@example.com');
    assert.equal(request.payload.password, 'secret:123456');
    assert.equal(account.provider, 'Ely.by');
    assert.equal(account.profile.name, 'player');
    assert.equal(account.mcToken, 'session-token');
  } finally {
    global.fetch = originalFetch;
  }
});

test('Ely.by login rejects empty credentials before making a request', async () => {
  await assert.rejects(authenticateEly('', ''), /Masukkan username/);
});