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
