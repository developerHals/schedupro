CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'Standard',
  full_name TEXT,
  status TEXT DEFAULT 'active',
  date_created DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  room_number TEXT NOT NULL,
  address TEXT,
  capacity INTEGER DEFAULT 20,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS holidays (
  id TEXT PRIMARY KEY,
  "Academic Year" TEXT,
  "Term" TEXT,
  "Description" TEXT,
  "Day" TEXT,
  "Date" TEXT,
  "holiday_key" INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  "Course ID" TEXT,
  "Course Name" TEXT,
  "Notes" TEXT,
  "Lesson Number" TEXT,
  "Lesson Length" TEXT,
  "Start time" TEXT,
  "End time" TEXT,
  "Room" TEXT,
  "Tutor" TEXT,
  "Start date" TEXT,
  "End date" TEXT,
  "Day Details" TEXT,
  "Comments" TEXT,
  created_by TEXT,
  fees REAL,
  approved_by TEXT,
  "Status" TEXT DEFAULT 'Pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
