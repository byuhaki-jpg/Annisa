-- Migration 0005: Convert Users Table to Support Email/Password & Hierarchy
-- ─────────────────────────────────────────────────────────────────

-- PRAGMA foreign_keys=off; -- Not needed in D1 normally, but just to be safe it's handled by D1 automatically

CREATE TABLE IF NOT EXISTS new_users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  name          TEXT,
  role          TEXT NOT NULL CHECK(role IN ('admin_utama', 'admin', 'petugas')),
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  password_hash TEXT
);

INSERT INTO new_users (id, email, name, role, is_active, created_at)
SELECT id, email, name, role, is_active, created_at FROM users;

-- For existing mockup user, we will just leave password_hash NULL.
-- In real app, the admin will set it via API.
-- For local dev, let's insert a default 'admin_utama' if there are no users, 
-- or we can just upgrade 'admin' to 'admin_utama' initially.
UPDATE new_users SET role = 'admin_utama' WHERE role = 'admin';

DROP TABLE users;
ALTER TABLE new_users RENAME TO users;
