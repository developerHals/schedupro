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
