const SESSION_COOKIE = 'schedupro_session';
const UNAUTHORIZED_COOKIE = 'schedupro_unauthorized';

function base64UrlEncode(input) {
  const base64 = btoa(input);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(input) {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return atob(base64);
}

function stringToBuffer(str) {
  return new TextEncoder().encode(str);
}

function bufferToBinaryString(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return binary;
}

function binaryStringToBuffer(str) {
  const buf = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) buf[i] = str.charCodeAt(i);
  return buf;
}

async function importSecret(secret) {
  return crypto.subtle.importKey(
    'raw',
    stringToBuffer(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function signJwt(payload, secret, expiresInSeconds = 8 * 60 * 60) {
  if (!secret) throw new Error('Missing signing secret');
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const body = { ...payload, iat: now, exp: now + expiresInSeconds };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(body));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const key = await importSecret(secret);
  const signature = await crypto.subtle.sign('HMAC', key, stringToBuffer(signingInput));
  const encodedSignature = base64UrlEncode(bufferToBinaryString(signature));

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

export async function verifyJwt(token, secret) {
  if (!secret) throw new Error('Missing signing secret');
  const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
  if (!encodedHeader || !encodedPayload || !encodedSignature) return null;

  try {
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const signature = binaryStringToBuffer(base64UrlDecode(encodedSignature));
    const key = await importSecret(secret);
    const valid = await crypto.subtle.verify('HMAC', key, signature, stringToBuffer(signingInput));
    if (!valid) return null;

    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function parseCookies(header) {
  if (!header) return {};
  return Object.fromEntries(
    header.split(';').map((cookie) => {
      const [key, ...value] = cookie.trim().split('=');
      return [key, decodeURIComponent(value.join('='))];
    })
  );
}

export function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.maxAge != null) parts.push(`Max-Age=${options.maxAge}`);
  return parts.join('; ');
}

export function clearCookie(name, options = {}) {
  return serializeCookie(name, '', { ...options, httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: 0 });
}

export async function createSessionCookie(email, secret, maxAge = 8 * 60 * 60) {
  const token = await signJwt({ email }, secret, maxAge);
  return serializeCookie(SESSION_COOKIE, token, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge });
}

export async function createUnauthorizedCookie(email, secret) {
  const token = await signJwt({ email, unauthorized: true }, secret, 600);
  return serializeCookie(UNAUTHORIZED_COOKIE, token, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: 600 });
}

export async function getSessionEmail(request, env) {
  const secret = env.AUTH_COOKIE_SECRET;
  if (!secret) throw new Error('AUTH_COOKIE_SECRET not configured');
  const cookies = parseCookies(request.headers.get('Cookie'));
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;
  const payload = await verifyJwt(token, secret);
  return payload?.email || null;
}

export async function getSessionUser(request, env) {
  const db = env.schedupro_db;
  if (!db) throw new Error('Database not configured');
  const email = await getSessionEmail(request, env);
  if (!email) return null;
  const { results } = await db
    .prepare('SELECT id, email, role, full_name, status, date_created FROM users WHERE email = ?1')
    .bind(email)
    .all();
  return results?.[0] || null;
}

export async function requireUser(request, env) {
  const user = await getSessionUser(request, env);
  if (!user) throw new Error('Unauthorized');
  if (user.status !== 'active') throw new Error('Account inactive');
  return user;
}

export async function requireRoles(request, env, roles) {
  const user = await requireUser(request, env);
  const userRole = String(user.role || '').toLowerCase();
  if (!roles.some((r) => String(r).toLowerCase() === userRole)) throw new Error('Forbidden');
  return user;
}
