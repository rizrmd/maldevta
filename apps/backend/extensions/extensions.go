package extensions

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"encore.app/backend/iam"
	"encore.dev/beta/auth"
	"encore.dev/beta/errs"
)

//encore:service
type Service struct{}

// ExtensionMetadata represents the metadata for an extension
type ExtensionMetadata struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Author      string   `json:"author,omitempty"`
	Version     string   `json:"version"`
	Category    string   `json:"category"`
	Enabled     bool     `json:"enabled"`
	IsDefault   bool     `json:"is_default"`
	Capabilities []string `json:"capabilities,omitempty"`
	ErrorCount   int      `json:"error_count,omitempty"`
	LastError    string   `json:"last_error,omitempty"`
	HasError     bool     `json:"has_error,omitempty"`
	Debug        bool     `json:"debug,omitempty"`
	Code         string   `json:"code,omitempty"`
	UI           string   `json:"ui,omitempty"`
}

// Category represents a category for organizing extensions
type Category struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

// ListExtensionsResponse returns the list of extensions for a project
type ListExtensionsResponse struct {
	Extensions []*ExtensionMetadata `json:"extensions"`
}

// ListCategoriesResponse returns the list of categories
type ListCategoriesResponse struct {
	Categories []*Category `json:"categories"`
}

// ToggleExtensionResponse returns the updated extension after toggle
type ToggleExtensionResponse struct {
	Extension *ExtensionMetadata `json:"extension"`
}

// UpdateExtensionParams contains the fields to update for an extension
type UpdateExtensionParams struct {
	Category string `json:"category,omitempty"`
}

// DebugModeParams contains the debug mode setting
type DebugModeParams struct {
	Debug bool `json:"debug"`
}

// DebugLogEntry represents a single debug log entry
type DebugLogEntry struct {
	Timestamp string `json:"timestamp"`
	Level     string `json:"level"`
	Source    string `json:"source"`
	Message   string `json:"message"`
	Data      string `json:"data,omitempty"`
}

// DebugLogsResponse returns the debug logs for an extension
type DebugLogsResponse struct {
	FrontendLogs []DebugLogEntry `json:"frontend_logs"`
	BackendLogs  []DebugLogEntry `json:"backend_logs"`
}

func initService() (*Service, error) {
	// Force database initialization by calling GetDB and executing a query
	db, err := iam.GetDB()
	if err != nil {
		return nil, fmt.Errorf("failed to initialize database: %w", err)
	}
	// Execute a simple query to force SQLite to create the database file
	var result int
	err = db.QueryRow("SELECT 1").Scan(&result)
	if err != nil {
		return nil, fmt.Errorf("failed to execute test query: %w", err)
	}
	fmt.Printf("[initService] Database initialized and tested successfully\n")
	return &Service{}, nil
}

// getDB returns the database instance
func (s *Service) getDB() (*sql.DB, error) {
	return iam.GetDB()
}

// requireProjectAccess checks if the user has access to the project
func (s *Service) requireProjectAccess(ctx context.Context, projectID string) error {
	raw := auth.Data()
	data, ok := raw.(*iam.AuthData)
	if !ok || data == nil {
		return &errs.Error{Code: errs.Unauthenticated, Message: "not authenticated"}
	}
	// For now, allow all authenticated users to access projects
	// TODO: Add proper project access control based on tenant/project ownership
	return nil
}

// ListExtensions returns all extensions for a project
//
//encore:api auth method=GET path=/projects/:projectId/extensions
func (s *Service) ListExtensions(ctx context.Context, projectId string) (*ListExtensionsResponse, error) {
	fmt.Printf("[ListExtensions] Called with projectId: '%s' (len=%d)\n", projectId, len(projectId))
	if err := s.requireProjectAccess(ctx, projectId); err != nil {
		fmt.Printf("[ListExtensions] Auth failed: %v\n", err)
		return nil, err
	}

	db, err := s.getDB()
	if err != nil {
		fmt.Printf("[ListExtensions] DB error: %v\n", err)
		return nil, err
	}

	// Get extensions from database
	rows, err := db.QueryContext(ctx, `
		SELECT id, name, description, author, version, category, enabled, is_default,
		       capabilities, error_count, last_error, debug, code, ui
		FROM project_extensions
		WHERE project_id = ?
		ORDER BY category, name
	`, projectId)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			// Table doesn't exist yet, return default extensions
			return s.getDefaultExtensions(), nil
		}
		return nil, err
	}
	defer rows.Close()

	extensions := make([]*ExtensionMetadata, 0)
	for rows.Next() {
		ext := &ExtensionMetadata{}
		var capabilitiesJSON sql.NullString
		var codeJSON, uiJSON sql.NullString
		var lastError sql.NullString
		var enabledInt, isDefaultInt, debugInt int

		err := rows.Scan(
			&ext.ID,
			&ext.Name,
			&ext.Description,
			&ext.Author,
			&ext.Version,
			&ext.Category,
			&enabledInt,
			&isDefaultInt,
			&capabilitiesJSON,
			&ext.ErrorCount,
			&lastError,
			&debugInt,
			&codeJSON,
			&uiJSON,
		)
		if err != nil {
			return nil, err
		}

		// Convert int to bool
		ext.Enabled = enabledInt != 0
		ext.IsDefault = isDefaultInt != 0
		ext.Debug = debugInt != 0

		// Handle nullable last_error
		if lastError.Valid {
			ext.LastError = lastError.String
		} else {
			ext.LastError = ""
		}

		// Parse capabilities JSON
		if capabilitiesJSON.Valid {
			json.Unmarshal([]byte(capabilitiesJSON.String), &ext.Capabilities)
		}

		// Parse code and UI if present
		if codeJSON.Valid {
			ext.Code = codeJSON.String
		}
		if uiJSON.Valid {
			ext.UI = uiJSON.String
		}

		ext.HasError = ext.ErrorCount > 0
		extensions = append(extensions, ext)
	}

	if rows.Err() != nil {
		return nil, rows.Err()
	}

	fmt.Printf("[ListExtensions] Found %d extensions for project %s\n", len(extensions), projectId)

	// If no extensions found, insert all default extensions and return them
	if len(extensions) == 0 {
		fmt.Printf("[ListExtensions] No extensions found for project %s, inserting defaults\n", projectId)
		defaultExts := s.getDefaultExtensions()

		for _, ext := range defaultExts.Extensions {
			capabilitiesJSON, _ := json.Marshal(ext.Capabilities)
			now := time.Now().UTC().Format(time.RFC3339)

			// Convert bool to int for SQLite
			enabledInt := 0
			if ext.Enabled {
				enabledInt = 1
			}
			isDefaultInt := 0
			if ext.IsDefault {
				isDefaultInt = 1
			}

			_, err = db.ExecContext(ctx, `
				INSERT INTO project_extensions (id, project_id, name, description, author, version, category, enabled, is_default, capabilities, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`, ext.ID, projectId, ext.Name, ext.Description, ext.Author, ext.Version, ext.Category,
				enabledInt, isDefaultInt, string(capabilitiesJSON), now, now)

			if err != nil {
				fmt.Printf("[ListExtensions] Failed to insert extension %s: %v\n", ext.ID, err)
			}
		}

		return defaultExts, nil
	}

	fmt.Printf("[ListExtensions] Returning %d extensions for project %s\n", len(extensions), projectId)
	return &ListExtensionsResponse{Extensions: extensions}, nil
}

// getDefaultExtensions returns the default extensions
func (s *Service) getDefaultExtensions() *ListExtensionsResponse {
	return &ListExtensionsResponse{
		Extensions: []*ExtensionMetadata{
			// Documents
			{
				ID:          "pdf",
				Name:        "PDF",
				Description: "Extract text content from PDF documents",
				Author:      "AIBase",
				Version:     "1.0.0",
				Category:    "Documents",
				Enabled:     true,
				IsDefault:   true,
				Capabilities: []string{"Process Uploaded Files", "Register Event Hooks", "Generate AI Titles", "Create Logger"},
			},
			{
				ID:          "excel",
				Name:        "Excel",
				Description: "Extract data from Excel spreadsheets (.xlsx) with SQL support via DuckDB",
				Author:      "AIBase",
				Version:     "1.0.0",
				Category:    "Documents",
				Enabled:     true,
				IsDefault:   true,
				Capabilities: []string{"Process Uploaded Files", "Register Event Hooks", "Generate AI Titles", "Create Logger"},
			},
			{
				ID:          "word",
				Name:        "Word",
				Description: "Extract text from Word documents (.docx)",
				Author:      "AIBase",
				Version:     "1.0.0",
				Category:    "Documents",
				Enabled:     true,
				IsDefault:   true,
				Capabilities: []string{"Process Uploaded Files", "Register Event Hooks", "Generate AI Titles", "Create Logger"},
			},
			{
				ID:          "image",
				Name:        "Image",
				Description: "Analyze images using AI vision (OpenAI Vision API)",
				Author:      "AIBase",
				Version:     "1.0.0",
				Category:    "Documents",
				Enabled:     false,
				IsDefault:   true,
				Capabilities: []string{"Process Uploaded Files", "Register Event Hooks", "Generate AI Titles", "Create Logger", "Network Access"},
			},
			{
				ID:          "powerpoint",
				Name:        "PowerPoint",
				Description: "Extract text from PowerPoint presentations (.pptx, .ppt)",
				Author:      "AIBase",
				Version:     "1.0.0",
				Category:    "Documents",
				Enabled:     false,
				IsDefault:   true,
				Capabilities: []string{},
			},
			// Web
			{
				ID:          "search",
				Name:        "Search",
				Description: "Web and image search using Brave Search API",
				Author:      "AIBase",
				Version:     "1.0.0",
				Category:    "Web",
				Enabled:     false,
				IsDefault:   true,
				Capabilities: []string{"Network Access"},
			},
			// Database
			{
				ID:          "postgresql",
				Name:        "PostgreSQL",
				Description: "Query PostgreSQL databases with secure credential storage",
				Author:      "AIBase",
				Version:     "1.0.0",
				Category:    "Database",
				Enabled:     false,
				IsDefault:   true,
				Capabilities: []string{"Read Stored Data", "Store Data", "Network Access"},
			},
			{
				ID:          "clickhouse",
				Name:        "ClickHouse",
				Description: "Query ClickHouse databases",
				Author:      "AIBase",
				Version:     "1.0.0",
				Category:    "Database",
				Enabled:     false,
				IsDefault:   false,
				Capabilities: []string{},
			},
			{
				ID:          "trino",
				Name:        "Trino",
				Description: "Query Trino databases",
				Author:      "AIBase",
				Version:     "1.0.0",
				Category:    "Database",
				Enabled:     false,
				IsDefault:   false,
				Capabilities: []string{},
			},
			// Visualization
			{
				ID:          "chart",
				Name:        "Chart",
				Description: "Display interactive charts (bar, line, pie, area) using ECharts",
				Author:      "AIBase",
				Version:     "1.0.0",
				Category:    "Visualization",
				Enabled:     false,
				IsDefault:   true,
				Capabilities: []string{},
			},
			{
				ID:          "table",
				Name:        "Table",
				Description: "Display tabular data with sortable columns",
				Author:      "AIBase",
				Version:     "1.0.0",
				Category:    "Visualization",
				Enabled:     false,
				IsDefault:   true,
				Capabilities: []string{},
			},
			{
				ID:          "mermaid",
				Name:        "Mermaid",
				Description: "Render Mermaid diagrams (flowcharts, sequence diagrams)",
				Author:      "AIBase",
				Version:     "1.0.0",
				Category:    "Visualization",
				Enabled:     false,
				IsDefault:   true,
				Capabilities: []string{},
			},
			// Chat
			{
				ID:          "chat-logger",
				Name:        "Chat Logger",
				Description: "Log chat messages for analytics (read-only)",
				Author:      "AIBase",
				Version:     "1.0.0",
				Category:    "Chat",
				Enabled:     false,
				IsDefault:   true,
				Capabilities: []string{"Read Chat Messages", "Register Event Hooks"},
			},
			{
				ID:          "profanity-filter",
				Name:        "Profanity Filter",
				Description: "Filter inappropriate content from user messages",
				Author:      "AIBase",
				Version:     "1.0.0",
				Category:    "Chat",
				Enabled:     false,
				IsDefault:   true,
				Capabilities: []string{"Read Chat Messages", "Modify Chat Messages", "Register Event Hooks"},
			},
			{
				ID:          "response-enhancer",
				Name:        "Response Enhancer",
				Description: "Add formatting and disclaimers to AI responses",
				Author:      "AIBase",
				Version:     "1.0.0",
				Category:    "Chat",
				Enabled:     false,
				IsDefault:   true,
				Capabilities: []string{"Read Chat Messages", "Modify Chat Messages", "Register Event Hooks"},
			},
			// Context
			{
				ID:          "context-manager",
				Name:        "Context Manager",
				Description: "Read/modify conversation context and compaction settings",
				Author:      "AIBase",
				Version:     "1.0.0",
				Category:    "Context",
				Enabled:     false,
				IsDefault:   true,
				Capabilities: []string{"context", "compaction"},
			},
			// Utilities
			{
				ID:          "peek",
				Name:        "Peek",
				Description: "Paginated view of large outputs",
				Author:      "AIBase",
				Version:     "1.0.0",
				Category:    "Utilities",
				Enabled:     false,
				IsDefault:   true,
				Capabilities: []string{},
			},
			{
				ID:          "extension-creator",
				Name:        "Extension Creator",
				Description: "Create extensions via natural language",
				Author:      "AIBase",
				Version:     "1.0.0",
				Category:    "Utilities",
				Enabled:     false,
				IsDefault:   true,
				Capabilities: []string{},
			},
		},
	}
}

// ListCategories returns all available categories
//
//encore:api auth method=GET path=/categories
func (s *Service) ListCategories(ctx context.Context) (*ListCategoriesResponse, error) {
	db, err := s.getDB()
	if err != nil {
		return nil, err
	}

	rows, err := db.QueryContext(ctx, `
		SELECT id, name, created_at
		FROM extension_categories
		ORDER BY name
	`)
	if err != nil {
		// If table doesn't exist, return default categories
		return s.getDefaultCategories(), nil
	}
	defer rows.Close()

	categories := make([]*Category, 0)
	for rows.Next() {
		cat := &Category{}
		if err := rows.Scan(&cat.ID, &cat.Name, &cat.CreatedAt); err != nil {
			return nil, err
		}
		categories = append(categories, cat)
	}

	if rows.Err() != nil {
		return nil, rows.Err()
	}

	// If no categories, return defaults
	if len(categories) == 0 {
		return s.getDefaultCategories(), nil
	}

	return &ListCategoriesResponse{Categories: categories}, nil
}

// getDefaultCategories returns the default categories
func (s *Service) getDefaultCategories() *ListCategoriesResponse {
	return &ListCategoriesResponse{
		Categories: []*Category{
			{ID: "database", Name: "Database", CreatedAt: time.Now()},
			{ID: "documents", Name: "Documents", CreatedAt: time.Now()},
			{ID: "utilities", Name: "Utilities", CreatedAt: time.Now()},
			{ID: "visualization", Name: "Visualization", CreatedAt: time.Now()},
			{ID: "web", Name: "Web", CreatedAt: time.Now()},
		},
	}
}

// ToggleExtension enables or disables an extension
//
//encore:api auth method=POST path=/projects/:projectId/extensions/:extensionId/toggle
func (s *Service) ToggleExtension(ctx context.Context, projectId string, extensionId string) (*ToggleExtensionResponse, error) {
	fmt.Printf("[ToggleExtension] Starting toggle: projectId=%s, extensionId=%s\n", projectId, extensionId)

	if err := s.requireProjectAccess(ctx, projectId); err != nil {
		fmt.Printf("[ToggleExtension] Auth check failed: %v\n", err)
		return nil, err
	}

	db, err := s.getDB()
	if err != nil {
		fmt.Printf("[ToggleExtension] Failed to get DB: %v\n", err)
		return nil, err
	}

	extensionId = strings.TrimSpace(extensionId)
	projectId = strings.TrimSpace(projectId)

	fmt.Printf("[ToggleExtension] Looking for extension: project_id=%s, id=%s\n", projectId, extensionId)

	// Get current state
	var currentEnabled bool
	err = db.QueryRowContext(ctx, `
		SELECT enabled FROM project_extensions
		WHERE project_id = ? AND id = ?
	`, projectId, extensionId).Scan(&currentEnabled)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			// Extension doesn't exist in database yet
			fmt.Printf("[ToggleExtension] Extension not found in DB, checking defaults\n")
			// Check if it's a default extension
			defaultExts := s.getDefaultExtensions()
			var found *ExtensionMetadata
			for _, ext := range defaultExts.Extensions {
				if ext.ID == extensionId {
					found = ext
					break
				}
			}

			if found == nil {
				fmt.Printf("[ToggleExtension] Extension %s not found in defaults\n", extensionId)
				return nil, &errs.Error{Code: errs.NotFound, Message: "extension not found"}
			}

			// Insert the extension with toggled state
			capabilitiesJSON, _ := json.Marshal(found.Capabilities)
			now := time.Now().UTC().Format(time.RFC3339)
			newEnabled := !found.Enabled

			// Convert bool to int for SQLite (0 = false, 1 = true)
			enabledInt := 0
			if newEnabled {
				enabledInt = 1
			}
			isDefaultInt := 0
			if found.IsDefault {
				isDefaultInt = 1
			}

			fmt.Printf("[ToggleExtension] Inserting extension: id=%s, project_id=%s, enabled=%v (int=%d)\n", found.ID, projectId, newEnabled, enabledInt)

			_, err = db.ExecContext(ctx, `
				INSERT INTO project_extensions (id, project_id, name, description, author, version, category, enabled, is_default, capabilities, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`, found.ID, projectId, found.Name, found.Description, found.Author, found.Version, found.Category,
				enabledInt, isDefaultInt, string(capabilitiesJSON), now, now)

			if err != nil {
				fmt.Printf("[ToggleExtension] Failed to insert extension: %v\n", err)
				return nil, fmt.Errorf("failed to insert extension: %w", err)
			}

			fmt.Printf("[ToggleExtension] Successfully inserted extension\n")

			// Return the toggled extension
			found.Enabled = newEnabled
			return &ToggleExtensionResponse{Extension: found}, nil
		}
		fmt.Printf("[ToggleExtension] Database query error: %v\n", err)
		return nil, fmt.Errorf("failed to query extension: %w", err)
	}

	// Toggle the state
	newEnabled := !currentEnabled

	// Convert bool to int for SQLite (0 = false, 1 = true)
	enabledInt := 0
	if newEnabled {
		enabledInt = 1
	}

	fmt.Printf("[ToggleExtension] Extension exists, toggling: current=%v, new=%v (int=%d)\n", currentEnabled, newEnabled, enabledInt)

	_, err = db.ExecContext(ctx, `
		UPDATE project_extensions
		SET enabled = ?, updated_at = ?
		WHERE project_id = ? AND id = ?
	`, enabledInt, time.Now().UTC().Format(time.RFC3339), projectId, extensionId)

	if err != nil {
		fmt.Printf("[ToggleExtension] Failed to update extension: %v\n", err)
		return nil, fmt.Errorf("failed to update extension: %w", err)
	}

	fmt.Printf("[ToggleExtension] Successfully updated extension\n")

	// Get the updated extension
	ext, err := s.getExtensionByID(ctx, projectId, extensionId)
	if err != nil {
		return nil, fmt.Errorf("failed to get updated extension: %w", err)
	}

	return &ToggleExtensionResponse{Extension: ext}, nil
}

// ReloadExtension clears caches and reloads an extension
//
//encore:api auth method=POST path=/projects/:projectId/extensions/:extensionId/reload
func (s *Service) ReloadExtension(ctx context.Context, projectId string, extensionId string) (*ToggleExtensionResponse, error) {
	if err := s.requireProjectAccess(ctx, projectId); err != nil {
		return nil, err
	}

	db, err := s.getDB()
	if err != nil {
		return nil, err
	}

	extensionId = strings.TrimSpace(extensionId)

	// Reset error count and last error
	_, err = db.ExecContext(ctx, `
		UPDATE project_extensions
		SET error_count = 0, last_error = '', updated_at = ?
		WHERE project_id = ? AND id = ?
	`, time.Now().UTC().Format(time.RFC3339), projectId, extensionId)

	if err != nil {
		return nil, err
	}

	// Get the updated extension
	ext, err := s.getExtensionByID(ctx, projectId, extensionId)
	if err != nil {
		return nil, err
	}

	return &ToggleExtensionResponse{Extension: ext}, nil
}

// SetDebugMode toggles debug mode for an extension
//
//encore:api auth method=PATCH path=/projects/:projectId/extensions/:extensionId/debug
func (s *Service) SetDebugMode(ctx context.Context, projectId string, extensionId string, p *DebugModeParams) (*ToggleExtensionResponse, error) {
	if err := s.requireProjectAccess(ctx, projectId); err != nil {
		return nil, err
	}

	db, err := s.getDB()
	if err != nil {
		return nil, err
	}

	extensionId = strings.TrimSpace(extensionId)

	_, err = db.ExecContext(ctx, `
		UPDATE project_extensions
		SET debug = ?, updated_at = ?
		WHERE project_id = ? AND id = ?
	`, p.Debug, time.Now().UTC().Format(time.RFC3339), projectId, extensionId)

	if err != nil {
		return nil, err
	}

	// Get the updated extension
	ext, err := s.getExtensionByID(ctx, projectId, extensionId)
	if err != nil {
		return nil, err
	}

	return &ToggleExtensionResponse{Extension: ext}, nil
}

// GetDebugLogs retrieves debug logs for an extension
//
//encore:api auth method=GET path=/projects/:projectId/extensions/:extensionId/debug
func (s *Service) GetDebugLogs(ctx context.Context, projectId string, extensionId string) (*DebugLogsResponse, error) {
	if err := s.requireProjectAccess(ctx, projectId); err != nil {
		return nil, err
	}

	extensionId = strings.TrimSpace(extensionId)

	// For now, return empty logs - in production this would query a logs table
	return &DebugLogsResponse{
		FrontendLogs: []DebugLogEntry{},
		BackendLogs:  []DebugLogEntry{},
	}, nil
}

// UpdateExtension updates an extension's properties
//
//encore:api auth method=PUT path=/projects/:projectId/extensions/:extensionId
func (s *Service) UpdateExtension(ctx context.Context, projectId string, extensionId string, p *UpdateExtensionParams) (*ToggleExtensionResponse, error) {
	if err := s.requireProjectAccess(ctx, projectId); err != nil {
		return nil, err
	}

	db, err := s.getDB()
	if err != nil {
		return nil, err
	}

	extensionId = strings.TrimSpace(extensionId)

	// Update the category if provided
	if p.Category != "" {
		_, err = db.ExecContext(ctx, `
			UPDATE project_extensions
			SET category = ?, updated_at = ?
			WHERE project_id = ? AND id = ?
		`, p.Category, time.Now().UTC().Format(time.RFC3339), projectId, extensionId)

		if err != nil {
			return nil, err
		}
	}

	// Get the updated extension
	ext, err := s.getExtensionByID(ctx, projectId, extensionId)
	if err != nil {
		return nil, err
	}

	return &ToggleExtensionResponse{Extension: ext}, nil
}

// DeleteExtension deletes a custom extension
//
//encore:api auth method=DELETE path=/projects/:projectId/extensions/:extensionId
func (s *Service) DeleteExtension(ctx context.Context, projectId string, extensionId string) error {
	if err := s.requireProjectAccess(ctx, projectId); err != nil {
		return err
	}

	db, err := s.getDB()
	if err != nil {
		return err
	}

	extensionId = strings.TrimSpace(extensionId)

	// Check if it's a default extension
	var isDefault bool
	err = db.QueryRowContext(ctx, `
		SELECT is_default FROM project_extensions
		WHERE project_id = ? AND id = ?
	`, projectId, extensionId).Scan(&isDefault)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return &errs.Error{Code: errs.NotFound, Message: "extension not found"}
		}
		return err
	}

	if isDefault {
		return &errs.Error{Code: errs.FailedPrecondition, Message: "cannot delete default extensions"}
	}

	// Delete the extension
	_, err = db.ExecContext(ctx, `
		DELETE FROM project_extensions
		WHERE project_id = ? AND id = ?
	`, projectId, extensionId)

	if err != nil {
		return err
	}

	return nil
}

// ResetExtensions resets all extensions to defaults
//
//encore:api auth method=POST path=/projects/:projectId/extensions-reset
func (s *Service) ResetExtensions(ctx context.Context, projectId string) (*ListExtensionsResponse, error) {
	if err := s.requireProjectAccess(ctx, projectId); err != nil {
		return nil, err
	}

	db, err := s.getDB()
	if err != nil {
		return nil, err
	}

	// Delete all custom extensions for this project
	_, err = db.ExecContext(ctx, `
		DELETE FROM project_extensions
		WHERE project_id = ? AND is_default = 0
	`, projectId)

	if err != nil {
		return nil, err
	}

	// Reset default extensions
	_, err = db.ExecContext(ctx, `
		UPDATE project_extensions
		SET enabled = 1, error_count = 0, last_error = '', debug = 0, updated_at = ?
		WHERE project_id = ? AND is_default = 1
	`, time.Now().UTC().Format(time.RFC3339), projectId)

	if err != nil {
		return nil, err
	}

	// Return the default extensions
	return s.getDefaultExtensions(), nil
}

// getExtensionByID retrieves a single extension by ID
func (s *Service) getExtensionByID(ctx context.Context, projectId string, extensionId string) (*ExtensionMetadata, error) {
	db, err := s.getDB()
	if err != nil {
		return nil, err
	}

	ext := &ExtensionMetadata{}
	var capabilitiesJSON sql.NullString
	var codeJSON, uiJSON sql.NullString
	var enabledInt, isDefaultInt, debugInt int
	var lastError sql.NullString

	err = db.QueryRowContext(ctx, `
		SELECT id, name, description, author, version, category, enabled, is_default,
		       capabilities, error_count, last_error, debug, code, ui
		FROM project_extensions
		WHERE project_id = ? AND id = ?
	`, projectId, extensionId).Scan(
		&ext.ID,
		&ext.Name,
		&ext.Description,
		&ext.Author,
		&ext.Version,
		&ext.Category,
		&enabledInt,
		&isDefaultInt,
		&capabilitiesJSON,
		&ext.ErrorCount,
		&lastError,
		&debugInt,
		&codeJSON,
		&uiJSON,
	)

	// Convert int to bool
	ext.Enabled = enabledInt != 0
	ext.IsDefault = isDefaultInt != 0
	ext.Debug = debugInt != 0

	// Handle nullable last_error
	if lastError.Valid {
		ext.LastError = lastError.String
	} else {
		ext.LastError = ""
	}

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "extension not found"}
		}
		return nil, err
	}

	// Parse capabilities JSON
	if capabilitiesJSON.Valid {
		json.Unmarshal([]byte(capabilitiesJSON.String), &ext.Capabilities)
	}

	// Parse code and UI if present
	if codeJSON.Valid {
		ext.Code = codeJSON.String
	}
	if uiJSON.Valid {
		ext.UI = uiJSON.String
	}

	ext.HasError = ext.ErrorCount > 0

	return ext, nil
}
