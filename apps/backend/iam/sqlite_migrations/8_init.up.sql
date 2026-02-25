-- Migration 8: add sub-client registration settings

-- Add subclient_registration_enabled column to projects table
ALTER TABLE projects ADD COLUMN subclient_registration_enabled INTEGER NOT NULL DEFAULT 1;
