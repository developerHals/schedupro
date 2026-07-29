import { parseCookies, serializeCookie } from './_helpers.js';

const PKCE_POSSIBLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

function randomString(length) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = '';
  for (let i = 0; i < length; i++) {
    out += PKCE_POSSIBLE[bytes[i] % PKCE_POSSIBLE.length];
  }
  return out;
}

function randomState() {
  return randomString(32);
}

function generateCodeVerifier() {
  return randomString(128);
}

async function sha256Base64Url(input) {
  const data = stringToBuffer(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const bin = String.fromCharCode(...new Uint8Array(hash));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function stringToBuffer(str) {
  return new TextEncoder().encode(str);
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const clientId = env.MICROSOFT_CLIENT_ID;
  const tenantId = env.MICROSOFT_TENANT_ID;

  if (!clientId || !tenantId) {
    return new Response('Microsoft SSO not configured', { status: 500 });
  }

  const redirectUri = new URL('/api/auth/callback', request.url).toString();
  const state = randomState();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await sha256Base64Url(codeVerifier);

  const authUrl = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_mode', 'query');
  authUrl.searchParams.set('scope', 'openid profile email User.Read');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  const headers = new Headers();
  headers.set('Location', authUrl.toString());
  headers.append('Set-Cookie', serializeCookie('schedupro_auth_state', state, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: 600 }));
  headers.append('Set-Cookie', serializeCookie('schedupro_auth_verifier', codeVerifier, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: 600 }));

  return new Response(null, { status: 302, headers });
}
