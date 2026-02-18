-- Migration 2: Add admin features for tenant management
-- This migration adds support for tenant logos and tracking update timestamps

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

-- Initialize updated_at for existing records
UPDATE tenants SET updated_at = created_at WHERE updated_at = 0;
UPDATE users SET updated_at = created_at WHERE updated_at = 0;
