-- Add location to existing rooms table and backfill the default centre
ALTER TABLE rooms ADD COLUMN location TEXT DEFAULT 'Wood Green Learning Centre';

-- Backfill existing rows
UPDATE rooms SET location = 'Wood Green Learning Centre' WHERE location IS NULL OR location = '';
