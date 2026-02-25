-- Migration 10: properly fix subclients table (retry of migration 9)

-- Properly recreate the subclients table to remove UNIQUE constraint from domain
CREATE TABLE subclients_fixed (
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

-- Copy existing data (if any)
INSERT INTO subclients_fixed (id, project_id, name, domain, created_by_user_id, created_at, description, short_id, pathname, registration_enabled, suspended, whatsapp_client_id, updated_at)
SELECT id, project_id, name,
  COALESCE(domain, ''),
  created_by_user_id,
  created_at,
  description,
  COALESCE(short_id, ''),
  COALESCE(pathname, ''),
  COALESCE(registration_enabled, 1),
  COALESCE(suspended, 0),
  whatsapp_client_id,
  COALESCE(updated_at, 0)
FROM subclients;

-- Drop old table and rename
DROP TABLE subclients;
ALTER TABLE subclients_fixed RENAME TO subclients;

-- Create indexes (no unique index on domain)
CREATE INDEX IF NOT EXISTS subclients_short_id_idx ON subclients(short_id);
CREATE INDEX IF NOT EXISTS subclients_project_idx ON subclients(project_id);
