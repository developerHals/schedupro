import {
  parseCookies,
  verifyJwt,
  clearCookie,
  createUnauthorizedCookie,
  getSessionUser,
  getSessionEmail,
  serializeCookie,
  signJwt,
} from './_helpers.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.schedupro_db;
  const secret = env.AUTH_COOKIE_SECRET;

  if (!db) {
    return new Response('Database not configured', { status: 500 });
  }
  if (!secret) {
    return new Response('Auth cookie secret not configured', { status: 500 });
  }

  const cookies = parseCookies(request.headers.get('Cookie'));
  const unauthorizedToken = cookies['schedupro_unauthorized'];
  if (unauthorizedToken) {
    const payload = await verifyJwt(unauthorizedToken, secret);
    if (payload && payload.unauthorized) {
      return Response.json({
        data: null,
        unauthorized: true,
        error: 'You do not have access to this application. Please contact the administrator.',
      });
    }
  }

  const user = await getSessionUser(request, env);
  if (!user) {
    const email = await getSessionEmail(request, env);
    if (email) {
      // Allow haringeylearns.ac.uk domain users to use the app as guests.
      if (email.endsWith('@haringeylearns.ac.uk')) {
        return Response.json({
          data: {
            user: {
              id: email,
              email,
              full_name: email,
              role: 'Guest',
              status: 'active',
              date_created: null,
            },
          },
          error: null,
        });
      }
      // Valid Microsoft session, but the email is not in the users table.
      const headers = new Headers();
      const unauthorizedCookie = await createUnauthorizedCookie(email, secret);
      headers.append('Set-Cookie', unauthorizedCookie);
      headers.append('Set-Cookie', clearCookie('schedupro_session'));
      return Response.json(
        {
          data: null,
          unauthorized: true,
          error: 'You do not have access to this application. Please contact the administrator.',
        },
        { headers }
      );
    }
    return Response.json({ data: null, error: 'Unauthorized' }, { status: 401 });
  }

  if (user.status !== 'active') {
    return Response.json({ data: null, error: 'Account inactive' }, { status: 403 });
  }

  return Response.json({ data: { user }, error: null });
}
