-- Migration 7: add extensions management tables

CREATE TABLE IF NOT EXISTS extension_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_extensions (
  id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  author TEXT,
  version TEXT NOT NULL DEFAULT '1.0.0',
  category TEXT,
  enabled INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0,
  capabilities TEXT,
  error_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  debug INTEGER NOT NULL DEFAULT 0,
  code TEXT,
  ui TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (project_id, id)
);

CREATE INDEX IF NOT EXISTS idx_project_extensions_project_id ON project_extensions(project_id);
CREATE INDEX IF NOT EXISTS idx_project_extensions_category ON project_extensions(category);
CREATE INDEX IF NOT EXISTS idx_project_extensions_enabled ON project_extensions(enabled);
