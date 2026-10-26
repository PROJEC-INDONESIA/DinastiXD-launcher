const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const ELY_AUTH_SERVER = 'https://authserver.ely.by';
const AUTHLIB_INJECTOR = {
  url: 'https://github.com/yushijinhun/authlib-injector/releases/download/v1.2.8/authlib-injector-1.2.8.jar',
  sha256: '9c7f4343e6c82034958ffb48c14a2cb0c85928be7283103ce17da00c6d5a7b10'
};

async function authRequest(endpoint, payload) {
  const response = await fetch(`${ELY_AUTH_SERVER}/auth/${endpoint}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.errorMessage || `Ely.by menolak login (${response.status}).`);
  return body;
}

async function authenticateEly(username, password, twoFactorToken = '') {
  if (typeof username !== 'string' || !username.trim() || typeof password !== 'string' || !password) {
    throw new Error('Masukkan username/email dan password Ely.by.');
  }

  const clientToken = crypto.randomUUID().replaceAll('-', '');
  const result = await authRequest('authenticate', {
    username: username.trim(),
    password: twoFactorToken ? `${password}:${twoFactorToken}` : password,
    clientToken,
    requestUser: true
  });
  const profile = result.selectedProfile;
  if (!result.accessToken || !profile?.id || !profile?.name) {
    throw new Error('Ely.by tidak mengembalikan profil Minecraft yang valid.');
  }
  return { provider: 'Ely.by', profile, mcToken: result.accessToken, clientToken };
}

async function refreshEly(account) {
  const result = await authRequest('refresh', {
    accessToken: account.mcToken,
    clientToken: account.clientToken,
    requestUser: true
  });
  const profile = result.selectedProfile || account.profile;
  if (!result.accessToken || !profile?.id || !profile?.name) {
    throw new Error('Sesi Ely.by tidak dapat diperbarui. Silakan login kembali.');
  }
  return { ...account, profile, mcToken: result.accessToken };
}

async function invalidateEly(account) {
  if (!account?.mcToken || !account?.clientToken) return;
  await authRequest('invalidate', { accessToken: account.mcToken, clientToken: account.clientToken }).catch(() => {});
}

async function validateEly(account) {
  try {
    await authRequest('validate', { accessToken: account.mcToken });
    return true;
  } catch {
    return false;
  }
}

async function ensureAuthlibInjector(gameDirectory) {
  const directory = path.join(gameDirectory, 'libraries', 'authlib-injector');
  const jarPath = path.join(directory, 'authlib-injector-1.2.8.jar');
  try {
    const existing = await fs.readFile(jarPath);
    const digest = crypto.createHash('sha256').update(existing).digest('hex');
    if (digest === AUTHLIB_INJECTOR.sha256) return jarPath;
  } catch {
    // Download when the trusted, pinned file is missing or invalid.
  }

  const response = await fetch(AUTHLIB_INJECTOR.url);
  if (!response.ok || !response.body) throw new Error('Authlib-injector tidak dapat diunduh.');
  const bytes = Buffer.from(await response.arrayBuffer());
  const digest = crypto.createHash('sha256').update(bytes).digest('hex');
  if (digest !== AUTHLIB_INJECTOR.sha256) throw new Error('Checksum authlib-injector tidak cocok.');

  await fs.mkdir(directory, { recursive: true });
  const temporaryPath = `${jarPath}.download`;
  await fs.writeFile(temporaryPath, bytes);
  await fs.rename(temporaryPath, jarPath);
  return jarPath;
}

module.exports = { authenticateEly, ensureAuthlibInjector, invalidateEly, refreshEly, validateEly };