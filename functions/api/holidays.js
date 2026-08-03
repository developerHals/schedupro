import { requireRoles } from './auth/_helpers.js';

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.schedupro_db;
  if (!db) {
    return new Response('Database not configured', { status: 500 });
  }
  const url = new URL(request.url);

  if (request.method === 'GET') {
    const academicYear = url.searchParams.get('academic_year');
    let sql = 'SELECT * FROM holidays';
    let stmt;
    if (academicYear) {
      sql += ' WHERE "Academic Year" = ?1';
      stmt = db.prepare(sql).bind(academicYear);
    } else {
      stmt = db.prepare(sql);
    }
    const { results } = await stmt.all();
    return Response.json({ data: results || [], error: null });
  }

  if (request.method === 'POST') {
    try {
      await requireRoles(request, env, ['Admin', 'Superuser']);
    } catch (err) {
      const status = err.message === 'Forbidden' || err.message === 'Account inactive' ? 403 : 401;
      return Response.json({ data: null, error: err.message }, { status });
    }

    const body = await request.json();
    const rows = Array.isArray(body) ? body : [body];
    const created = [];
    for (const row of rows) {
      const id = crypto.randomUUID();
      const academicYear = row['Academic Year'] || row.academic_year || '';
      const term = row['Term'] || row.term || '';
      const description = row['Description'] || row.description || '';
      const day = row['Day'] || row.day || '';
      const date = row['Date'] || row.date || '';
      const holidayKey = Number(row['holiday_key'] || row.holiday_key) || null;
      await db
        .prepare('INSERT INTO holidays (id, "Academic Year", "Term", "Description", "Day", "Date", "holiday_key") VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)')
        .bind(id, academicYear, term, description, day, date, holidayKey)
        .run();
      created.push({
        id,
        'Academic Year': academicYear,
        Term: term,
        Description: description,
        Day: day,
        Date: date,
        holiday_key: holidayKey,
      });
    }
    return Response.json({ data: created, error: null }, { status: 201 });
  }

  if (request.method === 'DELETE') {
    try {
      await requireRoles(request, env, ['Admin', 'Superuser']);
    } catch (err) {
      const status = err.message === 'Forbidden' || err.message === 'Account inactive' ? 403 : 401;
      return Response.json({ data: null, error: err.message }, { status });
    }

    const id = url.searchParams.get('id');
    const academicYear = url.searchParams.get('academic_year');
    if (!id && !academicYear) {
      return Response.json({ data: null, error: 'Missing id or academic_year query parameter' }, { status: 400 });
    }
    if (id) {
      await db.prepare('DELETE FROM holidays WHERE id = ?1').bind(id).run();
      return Response.json({ data: { id }, error: null });
    }
    await db.prepare('DELETE FROM holidays WHERE "Academic Year" = ?1').bind(academicYear).run();
    return Response.json({ data: { academic_year: academicYear }, error: null });
  }

  return new Response('Method not allowed', { status: 405 });
}
