import { requireUser, requireRoles } from '../auth/_helpers.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.schedupro_db;
  if (!db) return new Response('Database not configured', { status: 500 });

  try {
    await requireUser(request, env);
  } catch (err) {
    const status = err.message === 'Account inactive' ? 403 : 401;
    return Response.json({ data: null, error: err.message }, { status });
  }

  const url = new URL(request.url);
  const academicYear = url.searchParams.get('academicYear');
  const search = url.searchParams.get('search');
  const catLabel = url.searchParams.get('catLabel');
  const tutor = url.searchParams.get('tutor');
  const id = url.searchParams.get('id');

  const conditions = [];
  const values = [];
  if (id) {
    conditions.push(`c."ID" = ?${values.length + 1}`);
    values.push(id);
  }
  if (academicYear) {
    conditions.push(`c."AcademicYear" = ?${values.length + 1}`);
    values.push(academicYear);
  }
  if (catLabel) {
    conditions.push(`c."CatLabel" = ?${values.length + 1}`);
    values.push(catLabel);
  }
  if (tutor) {
    conditions.push(`c."Tutor" LIKE ?${values.length + 1}`);
    values.push(`%${tutor}%`);
  }
  if (search) {
    conditions.push(`(c."CourseTitle" LIKE ?${values.length + 1} OR c."CourseCode" LIKE ?${values.length + 1})`);
    values.push(`%${search}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `
    SELECT c.*, o.local_notes, o.local_status, o.updated_by AS override_updated_by, o.updated_at AS override_updated_at
    FROM lt_courses c
    LEFT JOIN lt_course_overrides o ON o.course_instance_id = c."ID"
    ${where}
    ORDER BY c."CourseCode" ASC
  `;

  const stmt = values.length ? db.prepare(sql).bind(...values) : db.prepare(sql);
  const { results } = await stmt.all();
  return Response.json({ data: results || [], error: null });
}

export async function onRequestPatch(context) {
  const { request, env } = context;
  const db = env.schedupro_db;
  if (!db) return new Response('Database not configured', { status: 500 });

  let user;
  try {
    user = await requireRoles(request, env, ['Admin', 'Superuser', 'CM']);
  } catch (err) {
    const status = err.message === 'Forbidden' || err.message === 'Account inactive' ? 403 : 401;
    return Response.json({ data: null, error: err.message }, { status });
  }

  const body = await request.json();
  const courseInstanceId = body.course_instance_id;
  if (!courseInstanceId) {
    return Response.json({ data: null, error: 'Missing course_instance_id' }, { status: 400 });
  }

  await db
    .prepare(
      `INSERT INTO lt_course_overrides (course_instance_id, local_notes, local_status, updated_by, updated_at)
       VALUES (?1, ?2, ?3, ?4, CURRENT_TIMESTAMP)
       ON CONFLICT(course_instance_id) DO UPDATE SET
         local_notes = COALESCE(?2, local_notes),
         local_status = COALESCE(?3, local_status),
         updated_by = ?4,
         updated_at = CURRENT_TIMESTAMP`
    )
    .bind(courseInstanceId, body.local_notes ?? null, body.local_status ?? null, user.email)
    .run();

  const updated = await db
    .prepare('SELECT * FROM lt_course_overrides WHERE course_instance_id = ?1')
    .bind(courseInstanceId)
    .first();
  return Response.json({ data: updated, error: null });
}

export async function onRequest(context) {
  const { request } = context;
  if (request.method === 'GET') return onRequestGet(context);
  if (request.method === 'PATCH') return onRequestPatch(context);
  return new Response('Method not allowed', { status: 405 });
}
