-- Migration 4: add system role support
-- Rebuild users table to widen role CHECK constraint.

PRAGMA foreign_keys = OFF;

BEGIN TRANSACTION;

CREATE TABLE users_new (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  subclient_id TEXT REFERENCES subclients(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  password_hash TEXT,
  role TEXT NOT NULL CHECK (role IN ('system', 'admin', 'user')),
  source TEXT NOT NULL CHECK (source IN ('manual', 'whatsapp')),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at INTEGER NOT NULL DEFAULT 0,
  email TEXT
);

INSERT INTO users_new (
  id, tenant_id, project_id, subclient_id, username, password_hash, role, source, created_at, updated_at, email
)
SELECT
  id, tenant_id, project_id, subclient_id, username, password_hash, role, source, created_at, updated_at, email
FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

CREATE UNIQUE INDEX users_tenant_username_subclient_uq ON users(tenant_id, username, subclient_id);
CREATE UNIQUE INDEX users_project_subclient_username_uq ON users(project_id, subclient_id, username);
CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);

COMMIT;

PRAGMA foreign_keys = ON;
