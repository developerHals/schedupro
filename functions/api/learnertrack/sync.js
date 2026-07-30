import { requireRoles } from '../auth/_helpers.js';
import { runSync } from './_sync-logic.js';

// Protected sync trigger. Called by:
//  - the cron-worker (via `Authorization: Bearer <LT_SYNC_SECRET>`)
//  - a Superuser manually from the app (via session cookie)
export async function onRequestPost(context) {
  const { request, env } = context;

  const authHeader = request.headers.get('Authorization') || '';
  const providedSecret = authHeader.replace(/^Bearer\s+/i, '');
  const hasValidSecret = env.LT_SYNC_SECRET && providedSecret === env.LT_SYNC_SECRET;

  if (!hasValidSecret) {
    try {
      await requireRoles(request, env, ['Admin', 'Superuser']);
    } catch (err) {
      const status = err.message === 'Forbidden' || err.message === 'Account inactive' ? 403 : 401;
      return Response.json({ data: null, error: err.message }, { status });
    }
  }

  const url = new URL(request.url);

  try {
    const academicYear = url.searchParams.get('academicYear');
    const result = await runSync(env, { academicYear: academicYear ? Number(academicYear) : undefined });
    return Response.json({ data: result, error: null });
  } catch (err) {
    return Response.json({ data: null, error: err.message }, { status: 500 });
  }
}

export async function onRequest(context) {
  if (context.request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  return onRequestPost(context);
}
