-- name: GetProject :one
SELECT * FROM projects
WHERE id = $1 AND tenant_id = $2;

-- name: GetEmbedCSS :one
SELECT custom_css FROM embed_css
WHERE project_id = $1;

-- name: UpsertEmbedCSS :one
INSERT INTO embed_css (project_id, custom_css, updated_at)
VALUES ($1, $2, CURRENT_TIMESTAMP)
ON CONFLICT(project_id) DO UPDATE SET
  custom_css = excluded.custom_css,
  updated_at = excluded.updated_at
RETURNING project_id;
