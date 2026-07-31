import { requireRoles } from '../auth/_helpers.js';

// GET is intentionally public (read-only, non-sensitive session listing).
// PATCH (local overrides) below still requires an authenticated staff role.
export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.schedupro_db;
  if (!db) return new Response('Database not configured', { status: 500 });

  const url = new URL(request.url);
  const courseInstanceId = url.searchParams.get('courseInstanceId');
  const academicYear = url.searchParams.get('academicYear');
  const date = url.searchParams.get('date');
  const dateFrom = url.searchParams.get('dateFrom');
  const dateTo = url.searchParams.get('dateTo');
  const day = url.searchParams.get('day');
  const tutor = url.searchParams.get('tutor');
  const search = url.searchParams.get('search');
  const room = url.searchParams.get('room');

  // "Date" may be stored with a time component depending on what Learner Track
  // returns, so compare only the first 10 chars (YYYY-MM-DD) for exact/range matches.
  const conditions = [];
  const values = [];
  if (courseInstanceId) {
    conditions.push(`s."CourseInstanceID" = ?${values.length + 1}`);
    values.push(courseInstanceId);
  }
  if (academicYear) {
    conditions.push(`s."AcademicYear" = ?${values.length + 1}`);
    values.push(academicYear);
  }
  if (date) {
    conditions.push(`substr(s."Date", 1, 10) = ?${values.length + 1}`);
    values.push(date);
  }
  if (dateFrom) {
    conditions.push(`substr(s."Date", 1, 10) >= ?${values.length + 1}`);
    values.push(dateFrom);
  }
  if (dateTo) {
    conditions.push(`substr(s."Date", 1, 10) <= ?${values.length + 1}`);
    values.push(dateTo);
  }
  if (day) {
    conditions.push(`s."DayOfWeek" LIKE ?${values.length + 1}`);
    values.push(`%${day}%`);
  }
  if (tutor) {
    conditions.push(`s."TutorLabel" LIKE ?${values.length + 1}`);
    values.push(`%${tutor}%`);
  }
  if (search) {
    conditions.push(`(s."CourseTitle" LIKE ?${values.length + 1} OR s."CourseLabel" LIKE ?${values.length + 1})`);
    values.push(`%${search}%`);
  }
  if (room) {
    conditions.push(`(s."RoomLabel" LIKE ?${values.length + 1} OR r.room_number LIKE ?${values.length + 2})`);
    values.push(`%${room}%`, `%${room}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `
    SELECT s.*,
           o.local_room_id, o.local_notes, o.local_approval_status,
           o.updated_by AS override_updated_by, o.updated_at AS override_updated_at,
           r.room_number AS local_room_number
    FROM lt_sessions s
    LEFT JOIN lt_session_overrides o ON o.session_id = s."ID"
    LEFT JOIN rooms r ON r.id = o.local_room_id
    ${where}
    ORDER BY s."Date" ASC, s."StartTime" ASC
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
  const sessionId = body.session_id;
  if (!sessionId) {
    return Response.json({ data: null, error: 'Missing session_id' }, { status: 400 });
  }

  const session = await db.prepare('SELECT "CourseInstanceID" FROM lt_sessions WHERE "ID" = ?1').bind(sessionId).first();
  if (!session) {
    return Response.json({ data: null, error: 'Session not found' }, { status: 404 });
  }

  await db
    .prepare(
      `INSERT INTO lt_session_overrides (session_id, course_instance_id, local_room_id, local_notes, local_approval_status, updated_by, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, CURRENT_TIMESTAMP)
       ON CONFLICT(session_id) DO UPDATE SET
         local_room_id = COALESCE(?3, local_room_id),
         local_notes = COALESCE(?4, local_notes),
         local_approval_status = COALESCE(?5, local_approval_status),
         updated_by = ?6,
         updated_at = CURRENT_TIMESTAMP`
    )
    .bind(
      sessionId,
      session.CourseInstanceID,
      body.local_room_id ?? null,
      body.local_notes ?? null,
      body.local_approval_status ?? null,
      user.email
    )
    .run();

  const updated = await db
    .prepare('SELECT * FROM lt_session_overrides WHERE session_id = ?1')
    .bind(sessionId)
    .first();
  return Response.json({ data: updated, error: null });
}

export async function onRequest(context) {
  const { request } = context;
  if (request.method === 'GET') return onRequestGet(context);
  if (request.method === 'PATCH') return onRequestPatch(context);
  return new Response('Method not allowed', { status: 405 });
}
