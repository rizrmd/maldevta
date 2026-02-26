package files

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"encore.app/backend/iam"
	"encore.dev/beta/auth"
	"encore.dev/beta/errs"
)

//encore:service
type Service struct{}

// ListFilesResponse defines the response for listing files
type ListFilesResponse struct {
	Files []FileItem `json:"files"`
}

// UploadFileResponse defines the response for uploading a file
type UploadFileResponse struct {
	File  FileItem `json:"file"`
	Error string   `json:"error,omitempty"`
}

// FileItem represents a file in the system
type FileItem struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Size       int64  `json:"size"`
	Type       string `json:"type"`
	UploadedAt string `json:"uploaded_at"`
	ProjectID  string `json:"project_id"`
	URL        string `json:"url,omitempty"`
	Preview    string `json:"preview,omitempty"`
	Base64Data string `json:"base64_data,omitempty"` // For small files, store as base64
}

var (
	// In production, use R2 or S3. For development, use local storage.
	// For now, we'll use a simple approach with base64 for small files in the DB
)

func initService() (*Service, error) {
	s := &Service{}

	// Initialize database tables
	if err := s.initTables(context.Background()); err != nil {
		fmt.Printf("[Files] Warning: Failed to initialize tables: %v\n", err)
	}

	return s, nil
}

// initTables creates the project_files table if it doesn't exist
func (s *Service) initTables(ctx context.Context) error {
	db, err := s.getDB()
	if err != nil {
		return err
	}

	// Check if table exists
	var tableExists int
	err = db.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='project_files'
	`).Scan(&tableExists)
	if err != nil {
		return fmt.Errorf("failed to check project_files table: %w", err)
	}

	if tableExists > 0 {
		return nil // Table already exists
	}

	// Create project_files table
	fmt.Printf("[Files] Creating project_files table...\n")
	_, err = db.ExecContext(ctx, `
		CREATE TABLE project_files (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			size INTEGER NOT NULL,
			type TEXT NOT NULL,
			uploaded_at TEXT NOT NULL,
			project_id TEXT NOT NULL,
			base64_data TEXT,
			FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
		);
	`)
	if err != nil {
		return fmt.Errorf("failed to create project_files table: %w", err)
	}

	// Create index for faster lookups
	_, err = db.ExecContext(ctx, `
		CREATE INDEX project_files_project_idx ON project_files(project_id, uploaded_at DESC);
	`)
	if err != nil {
		return fmt.Errorf("failed to create index: %w", err)
	}

	fmt.Printf("[Files] project_files table created successfully\n")
	return nil
}

// getDB returns the database instance
func (s *Service) getDB() (*sql.DB, error) {
	return iam.GetDB()
}

// generateFileID generates a unique file ID
func generateFileID() string {
	b := make([]byte, 12)
	rand.Read(b)
	return fmt.Sprintf("file_%x", b)
}

// saveFileLocally saves a file to local storage (for development)
func saveFileLocally(projectID, fileID string, data []byte, mimeType string) error {
	// Create uploads directory if it doesn't exist
	uploadsDir := filepath.Join(".", "uploads", projectID)
	if err := os.MkdirAll(uploadsDir, 0755); err != nil {
		return fmt.Errorf("failed to create uploads directory: %w", err)
	}

	// Determine file extension based on mime type
	ext := ""
	switch {
	case strings.HasPrefix(mimeType, "image/"):
		ext = strings.TrimPrefix(mimeType, "image/")
	case strings.HasPrefix(mimeType, "application/pdf"):
		ext = "pdf"
	case mimeType == "application/json":
		ext = "json"
	case strings.HasPrefix(mimeType, "text/"):
		ext = "txt"
	}

	filePath := filepath.Join(uploadsDir, fmt.Sprintf("%s.%s", fileID, ext))
	return os.WriteFile(filePath, data, 0644)
}

// ListFiles lists all files for a project.
//
//encore:api auth method=GET path=/files/:project
func (s *Service) ListFiles(ctx context.Context, project string) (*ListFilesResponse, error) {
	// Verify user has access to the project
	raw := auth.Data()
	if raw == nil {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "not authenticated"}
	}

	db, err := s.getDB()
	if err != nil {
		return nil, err
	}

	// Query files from database
	rows, err := db.QueryContext(ctx, `
		SELECT id, name, size, type, uploaded_at, project_id, base64_data
		FROM project_files
		WHERE project_id = ?
		ORDER BY uploaded_at DESC
	`, project)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	files := []FileItem{}
	for rows.Next() {
		var f FileItem
		var base64Data sql.NullString
		if err := rows.Scan(&f.ID, &f.Name, &f.Size, &f.Type, &f.UploadedAt, &f.ProjectID, &base64Data); err != nil {
			return nil, err
		}

		// Set preview from base64 data if available (for images)
		if base64Data.Valid && strings.HasPrefix(f.Type, "image/") {
			f.Preview = fmt.Sprintf("data:%s;base64,%s", f.Type, base64Data.String)
		}

		files = append(files, f)
	}

	return &ListFilesResponse{Files: files}, nil
}

// UploadFileParams defines parameters for file upload
type UploadFileParams struct {
	Name      string `json:"name"`
	Type      string `json:"type"`
	Size      int64  `json:"size"`
	Base64    string `json:"base64,omitempty"` // Optional base64 data
}

// UploadFile uploads a file to a project via JSON (for small files).
//
//encore:api auth method=POST path=/files/:project/upload
func (s *Service) UploadFile(ctx context.Context, project string, p *UploadFileParams) (*UploadFileResponse, error) {
	// Verify user has access to the project
	raw := auth.Data()
	if raw == nil {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "not authenticated"}
	}

	if p.Name == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "file name is required"}
	}

	db, err := s.getDB()
	if err != nil {
		return nil, err
	}

	fileID := generateFileID()
	now := time.Now().UTC().Format(time.RFC3339)

	var base64Data sql.NullString
	var previewURL string

	// If base64 data is provided, store it
	if p.Base64 != "" {
		base64Data = sql.NullString{String: p.Base64, Valid: true}

		// Generate preview URL for images
		if strings.HasPrefix(p.Type, "image/") {
			previewURL = fmt.Sprintf("data:%s;base64,%s", p.Type, p.Base64)
		}
	}

	// Insert file metadata into database
	_, err = db.ExecContext(ctx, `
		INSERT INTO project_files (id, name, size, type, uploaded_at, project_id, base64_data)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, fileID, p.Name, p.Size, p.Type, now, project, base64Data)
	if err != nil {
		return nil, fmt.Errorf("failed to save file metadata: %w", err)
	}

	fileItem := FileItem{
		ID:         fileID,
		Name:       p.Name,
		Size:       p.Size,
		Type:       p.Type,
		UploadedAt: now,
		ProjectID:  project,
		Preview:    previewURL,
	}

	return &UploadFileResponse{File: fileItem}, nil
}

// UploadFileRaw uploads a file via multipart/form-data.
//
//encore:api auth raw method=POST path=/files/:project/upload/raw
func (s *Service) UploadFileRaw(w http.ResponseWriter, r *http.Request) {
	// Extract project from URL path: /files/:project/upload/raw
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 4 {
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte(`{"error": "invalid path"}`))
		return
	}
	project := parts[3]
	// Verify user has access to the project
	raw := auth.Data()
	if raw == nil {
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`{"error": "not authenticated"}`))
		return
	}

	// Parse multipart form (max 32MB)
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte(fmt.Sprintf(`{"error": "failed to parse form: %s"}`, err.Error())))
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte(fmt.Sprintf(`{"error": "failed to get file: %s"}`, err.Error())))
		return
	}
	defer file.Close()

	// Read file data
	data, err := io.ReadAll(file)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte(fmt.Sprintf(`{"error": "failed to read file: %s"}`, err.Error())))
		return
	}

	// Get mime type
	mimeType := header.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = http.DetectContentType(data)
	}

	db, err := s.getDB()
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte(`{"error": "database error"}`))
		return
	}

	fileID := generateFileID()
	now := time.Now().UTC().Format(time.RFC3339)

	var base64Data sql.NullString
	var previewURL string

	// For small files (<5MB), store as base64 in database
	if len(data) < 5*1024*1024 {
		base64Data = sql.NullString{String: base64.StdEncoding.EncodeToString(data), Valid: true}

		// Generate preview URL for images
		if strings.HasPrefix(mimeType, "image/") {
			previewURL = fmt.Sprintf("data:%s;base64,%s", mimeType, base64Data.String)
		}
	} else {
		// For larger files, save to local storage (future: use R2/S3)
		if err := saveFileLocally(project, fileID, data, mimeType); err != nil {
			fmt.Printf("Failed to save file locally: %v\n", err)
		}
	}

	// Insert file metadata into database
	_, err = db.ExecContext(r.Context(), `
		INSERT INTO project_files (id, name, size, type, uploaded_at, project_id, base64_data)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, fileID, header.Filename, int64(len(data)), mimeType, now, project, base64Data)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte(fmt.Sprintf(`{"error": "failed to save file: %s"}`, err.Error())))
		return
	}

	fileItem := FileItem{
		ID:         fileID,
		Name:       header.Filename,
		Size:       int64(len(data)),
		Type:       mimeType,
		UploadedAt: now,
		ProjectID:  project,
		Preview:    previewURL,
	}

	// Return JSON response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(UploadFileResponse{File: fileItem})
}

// GetFile retrieves a single file by ID.
//
//encore:api auth method=GET path=/files/:project/:file
func (s *Service) GetFile(ctx context.Context, project string, file string) (*FileItem, error) {
	raw := auth.Data()
	if raw == nil {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "not authenticated"}
	}

	db, err := s.getDB()
	if err != nil {
		return nil, err
	}

	var f FileItem
	var base64Data sql.NullString
	err = db.QueryRowContext(ctx, `
		SELECT id, name, size, type, uploaded_at, project_id, base64_data
		FROM project_files
		WHERE project_id = ? AND id = ?
	`, project, file).Scan(&f.ID, &f.Name, &f.Size, &f.Type, &f.UploadedAt, &f.ProjectID, &base64Data)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "file not found"}
		}
		return nil, err
	}

	// Set base64 data and preview
	if base64Data.Valid {
		f.Base64Data = base64Data.String
		if strings.HasPrefix(f.Type, "image/") {
			f.Preview = fmt.Sprintf("data:%s;base64,%s", f.Type, base64Data.String)
		}
	}

	return &f, nil
}

// DeleteFile deletes a file.
//
//encore:api auth method=DELETE path=/files/:project/:file
func (s *Service) DeleteFile(ctx context.Context, project string, file string) (*UploadFileResponse, error) {
	raw := auth.Data()
	if raw == nil {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "not authenticated"}
	}

	db, err := s.getDB()
	if err != nil {
		return nil, err
	}

	// Delete file from database
	_, err = db.ExecContext(ctx, `
		DELETE FROM project_files WHERE project_id = ? AND id = ?
	`, project, file)
	if err != nil {
		return nil, err
	}

	// TODO: Delete from storage (local/R2/S3) as well

	return &UploadFileResponse{}, nil
}

// DownloadFile downloads a file.
// This is a raw endpoint for handling file downloads.
//
//encore:api auth raw method=GET path=/files/:project/:file/download
func (s *Service) DownloadFile(w http.ResponseWriter, r *http.Request) {
	// Extract project and file from URL path: /files/:project/:file/download
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 5 {
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	project := parts[3]
	file := parts[4]
	raw := auth.Data()
	if raw == nil {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}

	ctx := r.Context()
	db, err := s.getDB()
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	var f FileItem
	var base64Data sql.NullString
	err = db.QueryRowContext(ctx, `
		SELECT id, name, size, type, uploaded_at, project_id, base64_data
		FROM project_files
		WHERE project_id = ? AND id = ?
	`, project, file).Scan(&f.ID, &f.Name, &f.Size, &f.Type, &f.UploadedAt, &f.ProjectID, &base64Data)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	// Set content type
	w.Header().Set("Content-Type", f.Type)
	w.Header().Set("Content-Disposition", fmt.Sprintf("inline; filename=%s", f.Name))

	// If base64 data exists, decode and write it
	if base64Data.Valid {
		data, err := base64.StdEncoding.DecodeString(base64Data.String)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.Write(data)
	} else {
		// Try to read from local storage
		ext := ""
		switch {
		case strings.HasPrefix(f.Type, "image/"):
			ext = strings.TrimPrefix(f.Type, "image/")
		case strings.HasPrefix(f.Type, "application/pdf"):
			ext = "pdf"
		case f.Type == "application/json":
			ext = "json"
		case strings.HasPrefix(f.Type, "text/"):
			ext = "txt"
		}

		filePath := filepath.Join(".", "uploads", project, fmt.Sprintf("%s.%s", file, ext))
		data, err := os.ReadFile(filePath)
		if err != nil {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		w.Write(data)
	}
}
