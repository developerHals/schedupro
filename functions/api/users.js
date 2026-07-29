const VALID_ROLES = ['Standard', 'Admin', 'Superuser', 'CM'];
const VALID_STATUSES = ['active', 'inactive'];

export async function onRequest(context) {
  const db = context.env.schedupro_db;
  if (!db) {
    return new Response('Database not configured', { status: 500 });
  }
  const url = new URL(context.request.url);

  if (context.request.method === 'GET') {
    const email = url.searchParams.get('email');
    let sql = 'SELECT id, email, role, full_name, status, date_created FROM users';
    let stmt;
    if (email) {
      sql += ' WHERE email = ?1';
      stmt = db.prepare(sql).bind(email);
    } else {
      stmt = db.prepare(sql);
    }
    const { results } = await stmt.all();
    return Response.json({ data: results || [], error: null });
  }

  if (context.request.method === 'POST') {
    const body = await context.request.json();
    const rows = Array.isArray(body) ? body : [body];
    const created = [];
    for (const row of rows) {
      if (row.role !== undefined && row.role !== null) {
        const roleValue = String(row.role).trim();
        if (!VALID_ROLES.some((r) => r.toLowerCase() === roleValue.toLowerCase())) {
          return Response.json({ data: null, error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` }, { status: 400 });
        }
      }
      if (row.status !== undefined && row.status !== null) {
        const statusValue = String(row.status).trim().toLowerCase();
        if (!VALID_STATUSES.includes(statusValue)) {
          return Response.json({ data: null, error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
        }
      }
      const id = crypto.randomUUID();
      const role = VALID_ROLES.find((r) => r.toLowerCase() === String(row.role || '').trim().toLowerCase()) || 'Standard';
      const status = VALID_STATUSES.includes(String(row.status || '').trim().toLowerCase())
        ? String(row.status).trim().toLowerCase()
        : 'active';
      await db
        .prepare(
          'INSERT INTO users (id, email, role, full_name, status) VALUES (?1, ?2, ?3, ?4, ?5)'
        )
        .bind(
          id,
          row.email || '',
          role,
          row.full_name || '',
          status
        )
        .run();
      created.push({ id, ...row, role, status });
    }
    return Response.json({ data: created, error: null }, { status: 201 });
  }

  if (context.request.method === 'PATCH') {
    const id = url.searchParams.get('id');
    if (!id) {
      return Response.json({ data: null, error: 'Missing id query parameter' }, { status: 400 });
    }
    const body = await context.request.json();
    const allowed = ['email', 'role', 'full_name', 'status'];
    const fields = [];
    const values = [];
    for (const key of allowed) {
      if (body[key] !== undefined) {
        if (key === 'role') {
          const roleValue = String(body.role).trim();
          const role = VALID_ROLES.find((r) => r.toLowerCase() === roleValue.toLowerCase());
          if (!role) {
            return Response.json({ data: null, error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` }, { status: 400 });
          }
          fields.push(`${key} = ?${values.length + 1}`);
          values.push(role);
        } else if (key === 'status') {
          const statusValue = String(body.status).trim().toLowerCase();
          if (!VALID_STATUSES.includes(statusValue)) {
            return Response.json({ data: null, error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
          }
          fields.push(`${key} = ?${values.length + 1}`);
          values.push(statusValue);
        } else {
          fields.push(`${key} = ?${values.length + 1}`);
          values.push(body[key]);
        }
      }
    }
    if (fields.length === 0) {
      return Response.json({ data: null, error: 'No fields to update' }, { status: 400 });
    }
    values.push(id);
    await db
      .prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?${values.length}`)
      .bind(...values)
      .run();
    const updated = await db
      .prepare('SELECT id, email, role, full_name, status, date_created FROM users WHERE id = ?1')
      .bind(id)
      .first();
    return Response.json({ data: updated, error: null });
  }

  if (context.request.method === 'DELETE') {
    const id = url.searchParams.get('id');
    if (!id) {
      return Response.json({ data: null, error: 'Missing id query parameter' }, { status: 400 });
    }
    await db.prepare('DELETE FROM users WHERE id = ?1').bind(id).run();
    return Response.json({ data: { id }, error: null });
  }

  return new Response('Method not allowed', { status: 405 });
}
