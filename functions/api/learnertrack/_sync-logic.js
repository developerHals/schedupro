// Core Learner Track sync logic. Shared by:
//  - functions/api/learnertrack/sync.js (manual/HTTP-triggered sync on the Pages app)
//  - cron-worker/src/index.js (scheduled Worker that runs this on a timer)
//
// Pulls CourseInstance (filtered by academicYear) and, for each course,
// CourseInstanceSession, then upserts both into D1 (lt_courses / lt_sessions).
// Learner Track is treated as read-only: we never write back to it.

const LT_BASE_URL = 'https://api.learnertrack.net/api';

function buildUrl(path, params, env) {
  const url = new URL(`${LT_BASE_URL}/${path}`);
  url.searchParams.set('api_key', env.LT_API_KEY);
  url.searchParams.set('username', env.LT_USERNAME);
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`Learner Track request failed (${res.status}): ${url.split('?')[0]}`);
  }
  const json = await res.json();
  return Array.isArray(json) ? json : [];
}

async function upsertCourse(db, course) {
  await db
    .prepare(
      `INSERT INTO lt_courses (
        "ID","CourseCode","CatID","CatLabel","OptionGroupID","OptionGroup","ProviderID","ProviderLabel",
        "CoursetypeID","CourseTitle","CourseShortDescription","LocationID","LocationLabel","LocationPostcode",
        "Tutor","AcademicYear","StartTerm","Times","Weeks","AvailablePlaces","FullFee","ConcessionFee",
        "MaterialFee","ExamFee","TotalFeePayable","DeliveryModeID","ApprovalCode","ApprovalLabel","IsExam",
        "Level", raw_json, synced_at
      ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,?23,?24,?25,?26,?27,?28,?29,?30,?31,CURRENT_TIMESTAMP)
      ON CONFLICT("ID") DO UPDATE SET
        "CourseCode"=excluded."CourseCode", "CatID"=excluded."CatID", "CatLabel"=excluded."CatLabel",
        "OptionGroupID"=excluded."OptionGroupID", "OptionGroup"=excluded."OptionGroup",
        "ProviderID"=excluded."ProviderID", "ProviderLabel"=excluded."ProviderLabel",
        "CoursetypeID"=excluded."CoursetypeID", "CourseTitle"=excluded."CourseTitle",
        "CourseShortDescription"=excluded."CourseShortDescription", "LocationID"=excluded."LocationID",
        "LocationLabel"=excluded."LocationLabel", "LocationPostcode"=excluded."LocationPostcode",
        "Tutor"=excluded."Tutor", "AcademicYear"=excluded."AcademicYear", "StartTerm"=excluded."StartTerm",
        "Times"=excluded."Times", "Weeks"=excluded."Weeks", "AvailablePlaces"=excluded."AvailablePlaces",
        "FullFee"=excluded."FullFee", "ConcessionFee"=excluded."ConcessionFee", "MaterialFee"=excluded."MaterialFee",
        "ExamFee"=excluded."ExamFee", "TotalFeePayable"=excluded."TotalFeePayable",
        "DeliveryModeID"=excluded."DeliveryModeID", "ApprovalCode"=excluded."ApprovalCode",
        "ApprovalLabel"=excluded."ApprovalLabel", "IsExam"=excluded."IsExam", "Level"=excluded."Level",
        raw_json=excluded.raw_json, synced_at=CURRENT_TIMESTAMP`
    )
    .bind(
      course.ID, course.CourseCode, course.CatID, course.CatLabel, course.OptionGroupID, course.OptionGroup,
      course.ProviderID, course.ProviderLabel, course.CoursetypeID, course.CourseTitle,
      course.CourseShortDescription, course.LocationID, course.LocationLabel, course.LocationPostcode,
      course.Tutor, course.AcademicYear, course.StartTerm, course.Times, course.Weeks, course.AvailablePlaces,
      course.FullFee, course.ConcessionFee, course.MaterialFee, course.ExamFee, course.TotalFeePayable,
      course.DeliveryModeID, course.ApprovalCode, course.ApprovalLabel, course.IsExam, course.Level,
      JSON.stringify(course)
    )
    .run();
}

async function upsertSession(db, session) {
  await db
    .prepare(
      `INSERT INTO lt_sessions (
        "ID","CourseInstanceID","Session_number","CourseTitle","CourseLabel","CourseShortLabel",
        "CourseStatusCode","CourseStatus","CatID","AcademicYear","Date","DayOfWeek","StartTime","EndTime",
        "Term","BookingStatusID","BookingStatus","ProviderId","ProviderLabel","LocationId","LocationLabel",
        "RoomId","RoomLabel","TutorId","TutorLabel", raw_json, synced_at
      ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,?23,?24,?25,?26,CURRENT_TIMESTAMP)
      ON CONFLICT("ID") DO UPDATE SET
        "CourseInstanceID"=excluded."CourseInstanceID", "Session_number"=excluded."Session_number",
        "CourseTitle"=excluded."CourseTitle", "CourseLabel"=excluded."CourseLabel",
        "CourseShortLabel"=excluded."CourseShortLabel", "CourseStatusCode"=excluded."CourseStatusCode",
        "CourseStatus"=excluded."CourseStatus", "CatID"=excluded."CatID", "AcademicYear"=excluded."AcademicYear",
        "Date"=excluded."Date", "DayOfWeek"=excluded."DayOfWeek", "StartTime"=excluded."StartTime",
        "EndTime"=excluded."EndTime", "Term"=excluded."Term", "BookingStatusID"=excluded."BookingStatusID",
        "BookingStatus"=excluded."BookingStatus", "ProviderId"=excluded."ProviderId",
        "ProviderLabel"=excluded."ProviderLabel", "LocationId"=excluded."LocationId",
        "LocationLabel"=excluded."LocationLabel", "RoomId"=excluded."RoomId", "RoomLabel"=excluded."RoomLabel",
        "TutorId"=excluded."TutorId", "TutorLabel"=excluded."TutorLabel", raw_json=excluded.raw_json,
        synced_at=CURRENT_TIMESTAMP`
    )
    .bind(
      session.ID, session.CourseInstanceID, session.Session_number, session.CourseTitle, session.CourseLabel,
      session.CourseShortLabel, session.CourseStatusCode, session.CourseStatus, session.CatID,
      session.AcademicYear, session.Date, session.DayOfWeek, session.StartTime, session.EndTime, session.Term,
      session.BookingStatusID, session.BookingStatus, session.ProviderId, session.ProviderLabel,
      session.LocationId, session.LocationLabel, session.RoomId, session.RoomLabel, session.TutorId,
      session.TutorLabel, JSON.stringify(session)
    )
    .run();
}

export async function runSync(env, { academicYear } = {}) {
  const db = env.schedupro_db;
  if (!db) throw new Error('Database not configured');
  if (!env.LT_API_KEY || !env.LT_USERNAME) throw new Error('Learner Track credentials not configured');

  const year = academicYear || env.LT_ACADEMIC_YEAR || new Date().getFullYear();
  const log = await db
    .prepare('INSERT INTO lt_sync_log (academic_year, status) VALUES (?1, ?2)')
    .bind(year, 'running')
    .run();
  const logId = log.meta.last_row_id;

  let coursesSynced = 0;
  let sessionsSynced = 0;

  try {
    const courses = await fetchJson(buildUrl('CourseInstance', { academicYear: year }, env));
    for (const course of courses) {
      if (!course || !course.ID) continue;
      await upsertCourse(db, course);
      coursesSynced += 1;

      const sessions = await fetchJson(buildUrl('CourseInstanceSession', { courseinstanceid: course.ID }, env));
      for (const session of sessions) {
        if (!session || !session.ID) continue;
        await upsertSession(db, session);
        sessionsSynced += 1;
      }
    }

    await db
      .prepare(
        'UPDATE lt_sync_log SET finished_at = CURRENT_TIMESTAMP, courses_synced = ?1, sessions_synced = ?2, status = ?3 WHERE id = ?4'
      )
      .bind(coursesSynced, sessionsSynced, 'success', logId)
      .run();

    return { academicYear: year, coursesSynced, sessionsSynced };
  } catch (error) {
    await db
      .prepare(
        'UPDATE lt_sync_log SET finished_at = CURRENT_TIMESTAMP, courses_synced = ?1, sessions_synced = ?2, status = ?3, error = ?4 WHERE id = ?5'
      )
      .bind(coursesSynced, sessionsSynced, 'error', String(error.message || error), logId)
      .run();
    throw error;
  }
}
