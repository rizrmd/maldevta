-- Migration 5: add system scope support for sessions
-- Rebuild sessions table to widen scope_type CHECK constraint.

PRAGMA foreign_keys = OFF;

BEGIN TRANSACTION;

CREATE TABLE sessions_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('system', 'tenant', 'subclient')),
  scope_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  host TEXT,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO sessions_new (
  id, user_id, scope_type, scope_id, token_hash, host, expires_at, created_at
)
SELECT
  id, user_id, scope_type, scope_id, token_hash, host, expires_at, created_at
FROM sessions;

DROP TABLE sessions;
ALTER TABLE sessions_new RENAME TO sessions;

CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE INDEX sessions_expires_idx ON sessions(expires_at);

COMMIT;

PRAGMA foreign_keys = ON;
