import {
  parseCookies,
  serializeCookie,
  clearCookie,
  signJwt,
  createSessionCookie,
  createUnauthorizedCookie,
} from './_helpers.js';

function stringToBuffer(str) {
  return new TextEncoder().encode(str);
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  const clientId = env.MICROSOFT_CLIENT_ID;
  const clientSecret = env.MICROSOFT_CLIENT_SECRET;
  const tenantId = env.MICROSOFT_TENANT_ID;
  const secret = env.AUTH_COOKIE_SECRET;
  const db = env.schedupro_db;

  const headers = new Headers();

  if (error) {
    return Response.json({ data: null, error: `Login failed: ${errorDescription || error}` }, { status: 400 });
  }

  if (!clientId || !clientSecret || !tenantId || !secret || !db) {
    return new Response('SSO not fully configured', { status: 500 });
  }

  if (!code || !state) {
    return new Response('Missing authorization code or state', { status: 400 });
  }

  const cookies = parseCookies(request.headers.get('Cookie'));
  const savedState = cookies['schedupro_auth_state'];
  const savedVerifier = cookies['schedupro_auth_verifier'];

  if (!savedState || !savedVerifier || savedState !== state) {
    return new Response('Invalid or expired login session', { status: 400 });
  }

  const redirectUri = new URL('/api/auth/callback', request.url).toString();

  const tokenParams = new URLSearchParams();
  tokenParams.set('client_id', clientId);
  tokenParams.set('client_secret', clientSecret);
  tokenParams.set('code', code);
  tokenParams.set('redirect_uri', redirectUri);
  tokenParams.set('grant_type', 'authorization_code');
  tokenParams.set('code_verifier', savedVerifier);

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const tokenRes = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenParams.toString(),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    return Response.json({ data: null, error: `Token exchange failed: ${text}` }, { status: 400 });
  }

  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;
  if (!accessToken) {
    return Response.json({ data: null, error: 'No access token returned by Microsoft' }, { status: 400 });
  }

  // Use Microsoft Graph to get the user's profile
  const graphRes = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!graphRes.ok) {
    const text = await graphRes.text();
    return Response.json({ data: null, error: `Microsoft Graph call failed: ${text}` }, { status: 400 });
  }

  const graphData = await graphRes.json();
  const email = (graphData.mail || graphData.userPrincipalName || '').toLowerCase().trim();
  const fullName = graphData.displayName || '';

  if (!email) {
    return Response.json({ data: null, error: 'No email returned by Microsoft' }, { status: 400 });
  }

  // Clear the temporary PKCE cookies
  headers.append('Set-Cookie', clearCookie('schedupro_auth_state'));
  headers.append('Set-Cookie', clearCookie('schedupro_auth_verifier'));

  // Look the user up in the D1 users table
  const { results } = await db
    .prepare('SELECT id, email, role, full_name, status, date_created FROM users WHERE email = ?1')
    .bind(email)
    .all();

  const dbUser = results?.[0];

  if (!dbUser) {
    // Allow any user from the haringeylearns.ac.uk domain to log in as a guest.
    if (email.endsWith('@haringeylearns.ac.uk')) {
      const sessionCookie = await createSessionCookie(email, secret);
      headers.append('Set-Cookie', sessionCookie);
      headers.set('Location', '/');
      return new Response(null, { status: 302, headers });
    }
    const unauthorizedCookie = await createUnauthorizedCookie(email, secret);
    headers.append('Set-Cookie', unauthorizedCookie);
    headers.set('Location', '/?unauthorized=1');
    return new Response(null, { status: 302, headers });
  }

  if (dbUser.status !== 'active') {
    const unauthorizedCookie = await createUnauthorizedCookie(email, secret);
    headers.append('Set-Cookie', unauthorizedCookie);
    headers.set('Location', '/?unauthorized=1');
    return new Response(null, { status: 302, headers });
  }

  const sessionCookie = await createSessionCookie(email, secret);
  headers.append('Set-Cookie', sessionCookie);
  headers.set('Location', '/');
  return new Response(null, { status: 302, headers });
}
