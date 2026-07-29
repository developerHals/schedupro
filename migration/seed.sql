-- Seed the initial superuser for development and SSO testing.
-- Run with: npx wrangler d1 execute schedupro-db --file=./migration/seed.sql
INSERT OR REPLACE INTO users (id, email, role, full_name, status) VALUES (
  'dev-superuser-id',
  'development@haringeylearns.ac.uk',
  'Superuser',
  'Development Superuser',
  'active'
);
