-- Migration 9: add sub-client management fields

-- First, make domain column nullable (recreate table to drop NOT NULL constraint)
-- For SQLite, we need to recreate the table
CREATE TABLE IF NOT EXISTS subclients_new (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  domain TEXT NOT NULL DEFAULT '',
  created_by_user_id TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  description TEXT,
  short_id TEXT NOT NULL DEFAULT '',
  pathname TEXT NOT NULL DEFAULT '',
  registration_enabled INTEGER NOT NULL DEFAULT 1,
  suspended INTEGER NOT NULL DEFAULT 0,
  whatsapp_client_id TEXT,
  updated_at INTEGER NOT NULL DEFAULT 0
);

-- Copy existing data
INSERT INTO subclients_new (id, project_id, name, domain, created_by_user_id, created_at)
SELECT id, project_id, name, domain, created_by_user_id, created_at FROM subclients;

-- Drop old table and rename new one
DROP TABLE subclients;
ALTER TABLE subclients_new RENAME TO subclients;

-- Recreate indexes (note: no UNIQUE index on domain anymore)
CREATE INDEX IF NOT EXISTS subclients_short_id_idx ON subclients(short_id);
CREATE INDEX IF NOT EXISTS subclients_project_idx ON subclients(project_id);
