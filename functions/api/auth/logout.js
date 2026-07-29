import { clearCookie } from './_helpers.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const tenantId = env.MICROSOFT_TENANT_ID;

  const appUrl = new URL('/', request.url).toString();

  const headers = new Headers();
  headers.append('Set-Cookie', clearCookie('schedupro_session'));
  headers.append('Set-Cookie', clearCookie('schedupro_unauthorized'));
  headers.append('Set-Cookie', clearCookie('schedupro_auth_state'));
  headers.append('Set-Cookie', clearCookie('schedupro_auth_verifier'));

  const postLogout = encodeURIComponent(appUrl);
  const logoutUrl = tenantId
    ? `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/logout?post_logout_redirect_uri=${postLogout}`
    : appUrl;

  headers.set('Location', logoutUrl);
  return new Response(null, { status: 302, headers });
}
