import { requireRoles } from './auth/_helpers.js';

function parseCapacity(value) {
  if (value === undefined || value === null || value === '') return 20;
  const parsed = Number(value);
  return Number.isNaN(parsed) || parsed < 0 ? 20 : parsed;
}

async function ensureLocationColumn(db) {
  try {
    const { results } = await db.prepare('PRAGMA table_info(rooms)').all();
    if (!results) return;
    const hasLocation = results.some(col => col.name === 'location');
    if (!hasLocation) {
      await db.prepare('ALTER TABLE rooms ADD COLUMN location TEXT DEFAULT \'Wood Green Learning Centre\'').run();
      await db.prepare('UPDATE rooms SET location = \'Wood Green Learning Centre\' WHERE location IS NULL OR location = \'\'').run();
    }
  } catch (e) {
    console.error('ensureLocationColumn:', e);
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.schedupro_db;
  if (!db) {
    return new Response('Database not configured', { status: 500 });
  }
  const url = new URL(request.url);

  await ensureLocationColumn(db);

  try {
    const writeMethods = ['POST', 'PATCH', 'DELETE'];
    if (writeMethods.includes(request.method)) {
      await requireRoles(request, env, ['Admin', 'Superuser']);
    }
  } catch (err) {
    const status = err.message === 'Forbidden' || err.message === 'Account inactive' ? 403 : 401;
    return Response.json({ data: null, error: err.message }, { status });
  }

  if (request.method === 'GET') {
    const roomNumber = url.searchParams.get('room_number');
    let sql = 'SELECT id, room_number, location, address, capacity, created_at FROM rooms';
    let stmt;
    if (roomNumber) {
      sql += ' WHERE room_number = ?1';
      stmt = db.prepare(sql).bind(roomNumber);
    } else {
      stmt = db.prepare(sql);
    }
    const { results } = await stmt.all();
    return Response.json({ data: results || [], error: null });
  }

  if (request.method === 'POST') {
    const body = await request.json();
    const rows = Array.isArray(body) ? body : [body];
    const created = [];
    for (const row of rows) {
      const id = crypto.randomUUID();
      const capacity = parseCapacity(row.capacity);
      const location = row.location !== undefined && row.location !== null && row.location !== ''
        ? row.location
        : 'Wood Green Learning Centre';
      await db
        .prepare('INSERT INTO rooms (id, room_number, location, address, capacity) VALUES (?1, ?2, ?3, ?4, ?5)')
        .bind(id, row.room_number || '', location, row.address || '', capacity)
        .run();
      created.push({ id, room_number: row.room_number, location, address: row.address || '', capacity });
    }
    return Response.json({ data: created, error: null }, { status: 201 });
  }

  if (request.method === 'PATCH') {
    const id = url.searchParams.get('id');
    if (!id) {
      return Response.json({ data: null, error: 'Missing id query parameter' }, { status: 400 });
    }
    const body = await request.json();
    const fields = [];
    const values = [];
    if (body.room_number !== undefined) {
      fields.push(`room_number = ?${values.length + 1}`);
      values.push(body.room_number);
    }
    if (body.location !== undefined) {
      fields.push(`location = ?${values.length + 1}`);
      values.push(body.location);
    }
    if (body.address !== undefined) {
      fields.push(`address = ?${values.length + 1}`);
      values.push(body.address);
    }
    if (body.capacity !== undefined) {
      const capacity = Number(body.capacity);
      if (Number.isNaN(capacity) || capacity < 0) {
        return Response.json({ data: null, error: 'Invalid capacity' }, { status: 400 });
      }
      fields.push(`capacity = ?${values.length + 1}`);
      values.push(capacity);
    }
    if (fields.length === 0) {
      return Response.json({ data: null, error: 'No fields to update' }, { status: 400 });
    }
    values.push(id);
    await db
      .prepare(`UPDATE rooms SET ${fields.join(', ')} WHERE id = ?${values.length}`)
      .bind(...values)
      .run();
    const updated = await db
      .prepare('SELECT id, room_number, location, address, capacity, created_at FROM rooms WHERE id = ?1')
      .bind(id)
      .first();
    return Response.json({ data: updated, error: null });
  }

  if (request.method === 'DELETE') {
    const id = url.searchParams.get('id');
    if (!id) {
      return Response.json({ data: null, error: 'Missing id query parameter' }, { status: 400 });
    }
    await db.prepare('DELETE FROM rooms WHERE id = ?1').bind(id).run();
    return Response.json({ data: { id }, error: null });
  }

  return new Response('Method not allowed', { status: 405 });
}
