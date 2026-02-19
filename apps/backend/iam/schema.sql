CREATE TABLE licenses (
  id TEXT PRIMARY KEY,
  license_key TEXT NOT NULL,
  tenant_name TEXT NOT NULL,
  max_projects_per_tenant INTEGER NOT NULL,
  whatsapp_enabled INTEGER NOT NULL DEFAULT 0,
  subclient_enabled INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT NOT NULL UNIQUE,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  whatsapp_enabled INTEGER NOT NULL DEFAULT 0,
  subclient_enabled INTEGER NOT NULL DEFAULT 0,
  created_by_user_id TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX projects_tenant_name_uq ON projects(tenant_id, name);

CREATE TABLE subclients (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  domain TEXT NOT NULL UNIQUE,
  created_by_user_id TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  subclient_id TEXT REFERENCES subclients(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  password_hash TEXT,
  role TEXT NOT NULL CHECK (role IN ('system', 'admin', 'user')),
  source TEXT NOT NULL CHECK (source IN ('manual', 'whatsapp')),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, username, subclient_id),
  UNIQUE (project_id, subclient_id, username)
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('system', 'tenant', 'subclient')),
  scope_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  host TEXT,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE INDEX sessions_expires_idx ON sessions(expires_at);

-- Add embed settings fields to projects table
ALTER TABLE projects ADD COLUMN show_history INTEGER NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN use_client_uid INTEGER NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN allowed_origins TEXT;

-- Create table for embed CSS storage
CREATE TABLE IF NOT EXISTS embed_css (
  project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  custom_css TEXT NOT NULL DEFAULT '',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS embed_css_project_idx ON embed_css(project_id);

-- Add has_logo column to tenants table
ALTER TABLE tenants ADD COLUMN has_logo INTEGER NOT NULL DEFAULT 0;

-- Add updated_at column to tenants table (use 0 as default, will be updated on first write)
ALTER TABLE tenants ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;

-- Add updated_at column to users table (use 0 as default, will be updated on first write)
ALTER TABLE users ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;

-- Add email column to users table for admin management
ALTER TABLE users ADD COLUMN email TEXT;

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
