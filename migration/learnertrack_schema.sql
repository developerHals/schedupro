-- Learner Track integration tables.
-- lt_courses / lt_sessions mirror the external Learner Track API (CourseInstance /
-- CourseInstanceSession). Curated columns are extracted for fast filtering/sorting;
-- the full API response is kept in raw_json so no field is ever lost even if the
-- external schema changes.
-- lt_course_overrides / lt_session_overrides hold LOCAL-ONLY edits (notes, local
-- room assignment, local approval status) layered on top of the synced data.
-- Learner Track itself is never mutated by this app.

CREATE TABLE IF NOT EXISTS lt_courses (
  "ID" INTEGER PRIMARY KEY,
  "CourseCode" TEXT,
  "CatID" INTEGER,
  "CatLabel" TEXT,
  "OptionGroupID" INTEGER,
  "OptionGroup" TEXT,
  "ProviderID" INTEGER,
  "ProviderLabel" TEXT,
  "CoursetypeID" INTEGER,
  "CourseTitle" TEXT,
  "CourseShortDescription" TEXT,
  "LocationID" INTEGER,
  "LocationLabel" TEXT,
  "LocationPostcode" TEXT,
  "Tutor" TEXT,
  "AcademicYear" INTEGER,
  "StartTerm" TEXT,
  "Times" TEXT,
  "Weeks" INTEGER,
  "AvailablePlaces" INTEGER,
  "FullFee" REAL,
  "ConcessionFee" REAL,
  "MaterialFee" REAL,
  "ExamFee" REAL,
  "TotalFeePayable" REAL,
  "DeliveryModeID" INTEGER,
  "ApprovalCode" INTEGER,
  "ApprovalLabel" TEXT,
  "IsExam" INTEGER,
  "Level" TEXT,
  raw_json TEXT,
  synced_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lt_courses_academic_year ON lt_courses("AcademicYear");
CREATE INDEX IF NOT EXISTS idx_lt_courses_cat ON lt_courses("CatLabel");
CREATE INDEX IF NOT EXISTS idx_lt_courses_tutor ON lt_courses("Tutor");

CREATE TABLE IF NOT EXISTS lt_sessions (
  "ID" INTEGER PRIMARY KEY,
  "CourseInstanceID" INTEGER NOT NULL,
  "Session_number" INTEGER,
  "CourseTitle" TEXT,
  "CourseLabel" TEXT,
  "CourseShortLabel" TEXT,
  "CourseStatusCode" INTEGER,
  "CourseStatus" TEXT,
  "CatID" INTEGER,
  "AcademicYear" INTEGER,
  "Date" TEXT,
  "DayOfWeek" TEXT,
  "StartTime" TEXT,
  "EndTime" TEXT,
  "Term" TEXT,
  "BookingStatusID" INTEGER,
  "BookingStatus" TEXT,
  "ProviderId" INTEGER,
  "ProviderLabel" TEXT,
  "LocationId" INTEGER,
  "LocationLabel" TEXT,
  "RoomId" INTEGER,
  "RoomLabel" TEXT,
  "TutorId" INTEGER,
  "TutorLabel" TEXT,
  raw_json TEXT,
  synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("CourseInstanceID") REFERENCES lt_courses("ID")
);

CREATE INDEX IF NOT EXISTS idx_lt_sessions_course ON lt_sessions("CourseInstanceID");
CREATE INDEX IF NOT EXISTS idx_lt_sessions_date ON lt_sessions("Date");

CREATE TABLE IF NOT EXISTS lt_course_overrides (
  course_instance_id INTEGER PRIMARY KEY,
  local_notes TEXT,
  local_status TEXT,
  updated_by TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_instance_id) REFERENCES lt_courses("ID")
);

CREATE TABLE IF NOT EXISTS lt_session_overrides (
  session_id INTEGER PRIMARY KEY,
  course_instance_id INTEGER NOT NULL,
  local_room_id TEXT,
  local_notes TEXT,
  local_approval_status TEXT,
  updated_by TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES lt_sessions("ID"),
  FOREIGN KEY (local_room_id) REFERENCES rooms(id)
);

CREATE TABLE IF NOT EXISTS lt_sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  finished_at DATETIME,
  academic_year INTEGER,
  courses_synced INTEGER,
  sessions_synced INTEGER,
  status TEXT,
  error TEXT
);
