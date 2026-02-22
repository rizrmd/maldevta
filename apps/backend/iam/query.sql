-- name: GetSession :one
SELECT user_id, scope_type, scope_id, expires_at
FROM sessions
WHERE token_hash = ?;

-- name: GetUserByID :one
SELECT username, role, IFNULL(tenant_id, '') as tenant_id, IFNULL(project_id, '') as project_id, IFNULL(subclient_id, '') as subclient_id
FROM users
WHERE id = ?;

-- name: InsertLicense :exec
INSERT INTO licenses (id, license_key, max_projects_per_tenant, whatsapp_enabled, subclient_enabled, tenant_name)
VALUES (?, ?, ?, ?, ?, ?);

-- name: InsertTenant :exec
INSERT INTO tenants (id, name, domain, is_default)
VALUES (?, ?, ?, 1);

-- name: InsertUser :exec
INSERT INTO users (id, tenant_id, username, password_hash, role, source)
VALUES (?, ?, ?, ?, ?, ?);

-- name: InsertProject :exec
INSERT INTO projects (id, tenant_id, name, whatsapp_enabled, subclient_enabled, created_by_user_id, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?);

-- name: InsertSubclient :exec
INSERT INTO subclients (id, project_id, name, domain, created_by_user_id)
VALUES (?, ?, ?, ?, ?);

-- name: GetSubclientByDomain :one
SELECT id, project_id, (SELECT tenant_id FROM projects WHERE id = subclients.project_id) as tenant_id
FROM subclients
WHERE domain = ?;

-- name: GetSubclientUser :one
SELECT id, role, password_hash
FROM users
WHERE subclient_id = ? AND username = ?;

-- name: DeleteSession :exec
DELETE FROM sessions WHERE token_hash = ?;

-- name: ListProjects :many
SELECT id, tenant_id, name, whatsapp_enabled, subclient_enabled, created_by_user_id, created_at
FROM projects
WHERE tenant_id = ?
ORDER BY created_at DESC;

-- name: ListSubclients :many
SELECT id, project_id, name, domain
FROM subclients
WHERE project_id = ?
ORDER BY created_at DESC;

-- name: UpsertWhatsappUser :exec
INSERT INTO users (id, tenant_id, project_id, username, role, source)
VALUES (?, ?, ?, ?, ?, ?)
ON CONFLICT (project_id, subclient_id, username) DO NOTHING;

-- name: GetLicense :one
SELECT max_projects_per_tenant, whatsapp_enabled, subclient_enabled
FROM licenses
LIMIT 1;

-- name: CountLicenses :one
SELECT COUNT(*) FROM licenses;

-- name: InsertSession :exec
INSERT INTO sessions (id, user_id, scope_type, scope_id, token_hash, host, expires_at)
VALUES (?, ?, ?, ?, ?, ?, ?);

-- name: GetTenantUser :one
SELECT id, role, password_hash
FROM users
WHERE tenant_id = ? AND subclient_id IS NULL AND username = ?;

-- name: GetTenantByDomain :one
SELECT id FROM tenants WHERE domain = ?;

-- name: GetDefaultTenant :one
SELECT id FROM tenants WHERE is_default = 1 LIMIT 1;

-- name: CountProjectsForTenant :one
SELECT COUNT(*) FROM projects WHERE tenant_id = ?;

-- name: GetProjectByTenant :one
SELECT subclient_enabled, whatsapp_enabled
FROM projects
WHERE id = ? AND tenant_id = ?;

-- name: GetTenantByID :one
SELECT domain FROM tenants WHERE id = ?;

-- name: GetSubclientByID :one
SELECT domain FROM subclients WHERE id = ?;

-- name: GetSubclientFullByID :one
SELECT subclients.id, subclients.project_id, (SELECT tenant_id FROM projects WHERE id = subclients.project_id) as tenant_id
FROM subclients
WHERE subclients.id = ?;

-- name: UpdateProject :exec
UPDATE projects
SET name = ?
WHERE id = ? AND tenant_id = ?;

-- name: DeleteProject :exec
DELETE FROM projects
WHERE id = ? AND tenant_id = ?;

-- ============================================================================
-- TENANT MANAGEMENT QUERIES
-- ============================================================================

-- name: ListTenants :many
SELECT id, name, domain, is_default, has_logo, created_at, updated_at
FROM tenants
ORDER BY created_at DESC;

-- name: GetTenantDetail :one
SELECT id, name, domain, is_default, has_logo, created_at, updated_at
FROM tenants
WHERE id = ?;

-- name: UpdateTenant :exec
UPDATE tenants
SET name = ?, domain = ?, updated_at = ?
WHERE id = ?;

-- name: UpdateTenantLogo :exec
UPDATE tenants
SET has_logo = 1, updated_at = ?
WHERE id = ?;

-- name: DeleteTenantLogo :exec
UPDATE tenants
SET has_logo = 0, updated_at = ?
WHERE id = ?;

-- name: DeleteTenant :exec
DELETE FROM tenants WHERE id = ?;

-- name: CountTenants :one
SELECT COUNT(*) FROM tenants;

-- ============================================================================
-- USER MANAGEMENT QUERIES
-- ============================================================================

-- name: ListUsersByTenant :many
SELECT id, tenant_id, username, email, role, source, created_at, updated_at
FROM users
WHERE tenant_id = ? AND subclient_id IS NULL
ORDER BY created_at DESC;

-- name: GetUserDetail :one
SELECT id, tenant_id, username, email, password_hash, role, source, created_at, updated_at
FROM users
WHERE id = ?;

-- name: GetUserByEmail :one
SELECT id, tenant_id, username, email, password_hash, role, source, created_at, updated_at
FROM users
WHERE email = ?;

-- name: CreateUser :exec
INSERT INTO users (id, tenant_id, username, email, password_hash, role, source, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);

-- name: UpdateUser :exec
UPDATE users
SET username = ?, email = ?, role = ?, updated_at = ?
WHERE id = ?;

-- name: UpdateUserPassword :exec
UPDATE users
SET password_hash = ?, updated_at = ?
WHERE id = ?;

-- name: DeleteUser :exec
DELETE FROM users WHERE id = ?;

-- name: CountUsersByTenant :one
SELECT COUNT(*) FROM users WHERE tenant_id = ? AND subclient_id IS NULL;
-- name: GetProject :one
SELECT * FROM projects
WHERE id = ? AND tenant_id = ?;

-- name: GetEmbedCSS :one
SELECT custom_css FROM embed_css
WHERE project_id = ?;

-- name: UpsertEmbedCSS :one
INSERT INTO embed_css (project_id, custom_css, updated_at)
VALUES (?, ?, CURRENT_TIMESTAMP)
ON CONFLICT(project_id) DO UPDATE SET
  custom_css = excluded.custom_css,
  updated_at = excluded.updated_at
RETURNING project_id;

-- ============================================================================
-- ROLE-BASED CHAT QUERIES
-- ============================================================================

-- name: GetProjectWithRole :one
SELECT id, tenant_id, name, whatsapp_enabled, subclient_enabled, created_by_user_id, created_at, context_role
FROM projects
WHERE id = ? AND tenant_id = ?;

-- name: UpdateProjectRole :exec
UPDATE projects
SET context_role = ?
WHERE id = ? AND tenant_id = ?;
