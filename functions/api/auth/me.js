// DEV ONLY: returns the hardcoded superuser so the UI can be tested.
// Replace this with Microsoft SSO / Entra ID integration before production.
export async function onRequest(context) {
  const db = context.env.schedupro_db;
  const email = 'development@haringeylearns.ac.uk';

  const user = await db
    .prepare('SELECT id, email, role, full_name, status, date_created FROM users WHERE email = ?1')
    .bind(email)
    .first();

  if (user) {
    return Response.json({ data: { user }, error: null });
  }

  // If the superuser row does not exist yet, return a synthetic profile.
  return Response.json({
    data: {
      user: {
        id: 'dev-superuser',
        email,
        role: 'Superuser',
        full_name: 'Development Superuser',
        status: 'active',
        date_created: new Date().toISOString(),
      },
    },
    error: null,
  });
}
