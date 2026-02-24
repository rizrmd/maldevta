package files

import (
	"context"
	"net/http"
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
}

func initService() (*Service, error) {
	return &Service{}, nil
}

// ListFiles lists all files for a project.
//
//encore:api public method=GET path=/files/:project
func (s *Service) ListFiles(ctx context.Context, project string) (*ListFilesResponse, error) {
	return &ListFilesResponse{Files: []FileItem{}}, nil
}

// UploadFile uploads a file to a project.
//
//encore:api public method=POST path=/files/:project/upload
func (s *Service) UploadFile(ctx context.Context, project string, req *http.Request) (*UploadFileResponse, error) {
	return &UploadFileResponse{}, nil
}

// DeleteFile deletes a file.
//
//encore:api public method=DELETE path=/files/:project/:file
func (s *Service) DeleteFile(ctx context.Context, project string, file string) (*UploadFileResponse, error) {
	return &UploadFileResponse{}, nil
}

// DownloadFile downloads a file.
//
//encore:api public method=GET path=/files/:project/:file/download
func (s *Service) DownloadFile(ctx context.Context, project string, file string, req *http.Request) (*http.Response, error) {
	return nil, nil
}
