import { createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
const CAPTCHA_TTL_SECONDS = 5 * 60;

function base64UrlEncode(value) {
  return Buffer.from(value).toString('base64url');
}

function base64UrlJson(value) {
  return base64UrlEncode(JSON.stringify(value));
}

function sign(value, secret) {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function normalizeSecret(secret) {
  return secret || 'glucose-dev-auth-secret';
}

function verifySignedPayload(token, secret, now = Math.floor(Date.now() / 1000)) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;
  const unsigned = `${header}.${payload}`;
  const expected = sign(unsigned, normalizeSecret(secret));
  const actual = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (actual.length !== expectedBuffer.length || !timingSafeEqual(actual, expectedBuffer)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!parsed.exp || parsed.exp < now) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase();
}

export function hashPassword(password, salt = randomBytes(16).toString('base64url')) {
  const hash = scryptSync(String(password), salt, 64).toString('base64url');
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password, storedHash) {
  const [algorithm, salt, expectedHash] = String(storedHash || '').split(':');
  if (algorithm !== 'scrypt' || !salt || !expectedHash) return false;

  const actual = Buffer.from(scryptSync(String(password), salt, 64).toString('base64url'));
  const expected = Buffer.from(expectedHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function publicUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName || user.username
  };
}

export function createAuthToken(user, secret, now = Math.floor(Date.now() / 1000)) {
  const safeUser = publicUser(user);
  const header = base64UrlJson({ alg: 'HS256', typ: 'JWT' });
  const payload = base64UrlJson({
    sub: safeUser.id,
    username: safeUser.username,
    displayName: safeUser.displayName,
    exp: now + TOKEN_TTL_SECONDS
  });
  const unsigned = `${header}.${payload}`;
  return `${unsigned}.${sign(unsigned, normalizeSecret(secret))}`;
}

export function verifyAuthToken(token, secret, now = Math.floor(Date.now() / 1000)) {
  const parsed = verifySignedPayload(token, secret, now);
  if (!parsed?.sub) return null;
  return parsed;
}

export function createCaptchaChallenge(secret, now = Math.floor(Date.now() / 1000)) {
  const operator = randomInt(0, 2) === 0 ? '+' : '-';
  let left = randomInt(2, 10);
  let right = randomInt(1, 9);

  if (operator === '-' && left < right) {
    [left, right] = [right, left];
  }

  const answer = operator === '+' ? left + right : left - right;
  const header = base64UrlJson({ alg: 'HS256', typ: 'CAPTCHA' });
  const payload = base64UrlJson({
    purpose: 'captcha',
    answer: String(answer),
    nonce: randomBytes(8).toString('base64url'),
    exp: now + CAPTCHA_TTL_SECONDS
  });
  const unsigned = `${header}.${payload}`;

  return {
    question: `${left} ${operator} ${right} = ?`,
    token: `${unsigned}.${sign(unsigned, normalizeSecret(secret))}`,
    expiresIn: CAPTCHA_TTL_SECONDS
  };
}

export function verifyCaptchaAnswer(token, answer, secret, now = Math.floor(Date.now() / 1000)) {
  const parsed = verifySignedPayload(token, secret, now);
  if (parsed?.purpose !== 'captcha' || typeof parsed.answer !== 'string') return false;

  const actual = Buffer.from(String(answer ?? '').trim());
  const expected = Buffer.from(parsed.answer);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function tokenFromAuthorizationHeader(value) {
  const match = String(value || '').match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : '';
}
