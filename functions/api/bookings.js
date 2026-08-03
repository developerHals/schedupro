import { getSessionEmail, getSessionUser } from './auth/_helpers.js';

const SAFE_COLUMN = /^[A-Za-z0-9 _\-]+$/;

function getWhereFilter(url) {
  // Use the first query parameter as the WHERE filter (dataService sends one eq filter).
  for (const [key, value] of url.searchParams) {
    if (!SAFE_COLUMN.test(key)) continue;
    return { column: key, value };
  }
  return null;
}

function whereSql(filter) {
  if (!filter) return '';
  return ` WHERE "${filter.column}" = ?1`;
}

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.schedupro_db;
  if (!db) {
    return new Response('Database not configured', { status: 500 });
  }
  const url = new URL(request.url);

  if (request.method === 'GET') {
    const filter = getWhereFilter(url);
    let sql = 'SELECT * FROM bookings';
    let stmt;
    if (filter) {
      sql += whereSql(filter);
      stmt = db.prepare(sql).bind(filter.value);
    } else {
      stmt = db.prepare(sql);
    }
    const { results } = await stmt.all();
    return Response.json({ data: results || [], error: null });
  }

  const email = await getSessionEmail(request, env);
  if (!email) {
    return Response.json({ data: null, error: 'Unauthorized' }, { status: 401 });
  }

  const dbUser = await getSessionUser(request, env);
  const role = String(dbUser?.role || '').toLowerCase();
  const isPrivileged = role === 'superuser' || role === 'admin';

  if (request.method === 'POST') {
    const body = await request.json();
    const rows = Array.isArray(body) ? body : [body];
    const created = [];

    for (const row of rows) {
      const status = row['Status'] || row['Lesson Number'] || 'Pending';

      // Rate limit booking requests (Pending, non-privileged users): 3 per 10 minutes.
      if (!isPrivileged && String(status).toLowerCase() !== 'approved') {
        const { results: recent } = await db
          .prepare(
            'SELECT COUNT(*) AS count FROM bookings WHERE created_by = ?1 AND "Status" = ?2 AND created_at > datetime("now", "-10 minutes")'
          )
          .bind(email, 'Pending')
          .all();
        const count = recent?.[0]?.count || 0;
        if (count >= 3) {
          return Response.json(
            { data: null, error: 'Rate limit exceeded: you can only submit 3 booking requests within a 10-minute window.' },
            { status: 429 }
          );
        }
      }

      const id = row.id || crypto.randomUUID();
      const toInsert = { ...row, id };
      if (toInsert['Status'] === undefined && toInsert['Lesson Number'] === undefined) {
        toInsert['Status'] = 'Pending';
      }
      if (toInsert.created_by === undefined) toInsert.created_by = email;

      const keys = Object.keys(toInsert).filter((k) => SAFE_COLUMN.test(k));
      const placeholders = keys.map((_, i) => `?${i + 1}`).join(', ');
      const columnList = keys.map((k) => `"${k}"`).join(', ');
      const values = keys.map((k) => toInsert[k]);

      await db
        .prepare(`INSERT INTO bookings (${columnList}) VALUES (${placeholders})`)
        .bind(...values)
        .run();

      const inserted = await db.prepare('SELECT * FROM bookings WHERE id = ?1').bind(id).first();
      created.push(inserted);
    }
    return Response.json({ data: created, error: null }, { status: 201 });
  }

  if (request.method === 'PATCH' || request.method === 'DELETE') {
    const filter = getWhereFilter(url);
    if (!filter) {
      return Response.json({ data: null, error: 'Missing id or filter query parameter' }, { status: 400 });
    }

    // Verify ownership or privileged role before mutating.
    const { results: rows } = await db
      .prepare(`SELECT * FROM bookings${whereSql(filter)}`)
      .bind(filter.value)
      .all();
    const matches = rows || [];
    const isOwner = matches.length > 0 && matches.every((r) => r.created_by === email);
    if (!isPrivileged && !isOwner) {
      return Response.json({ data: null, error: 'Forbidden' }, { status: 403 });
    }

    if (request.method === 'DELETE') {
      await db
        .prepare(`DELETE FROM bookings${whereSql(filter)}`)
        .bind(filter.value)
        .run();
      return Response.json({ data: { [filter.column]: filter.value }, error: null });
    }

    const body = await request.json();
    const allowedKeys = Object.keys(body).filter((k) => SAFE_COLUMN.test(k) && k !== 'id' && k !== 'created_at');
    if (allowedKeys.length === 0) {
      return Response.json({ data: null, error: 'No fields to update' }, { status: 400 });
    }
    const fields = allowedKeys.map((k, i) => `"${k}" = ?${i + 1}`).join(', ');
    const values = allowedKeys.map((k) => body[k]);
    values.push(filter.value);
    const updated = await db
      .prepare(`UPDATE bookings SET ${fields} WHERE "${filter.column}" = ?${values.length}`)
      .bind(...values)
      .run();
    return Response.json({ data: { updated }, error: null });
  }

  return new Response('Method not allowed', { status: 405 });
}
