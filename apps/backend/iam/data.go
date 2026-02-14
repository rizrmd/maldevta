package iam

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"encore.dev/beta/auth"
	"encore.dev/beta/errs"
)

// Directory structure helpers
var dataDir string

func init() {
	// Initialize data directory path
	dataDir = os.Getenv("DATA_DIR")
	if dataDir == "" {
		exePath, err := os.Executable()
		if err != nil {
			panic(fmt.Sprintf("failed to get executable path: %v", err))
		}
		dataDir = filepath.Join(filepath.Dir(exePath), "data")
	}
}

func getDataDir() string {
	return dataDir
}

func getTenantPath(tenantID string) string {
	return filepath.Join(getDataDir(), "tenants", tenantID)
}

func getProjectPath(tenantID, projectID string) string {
	return filepath.Join(getTenantPath(tenantID), "projects", projectID)
}

func getProjectFilesPath(tenantID, projectID string) string {
	return filepath.Join(getProjectPath(tenantID, projectID), "files")
}

func getProjectChatsPath(tenantID, projectID string) string {
	return filepath.Join(getProjectPath(tenantID, projectID), "chats")
}

func getProjectWAMetaPath(tenantID, projectID string) string {
	return filepath.Join(getProjectPath(tenantID, projectID), "wa_meta")
}

func getConversationPath(tenantID, projectID, conversationID string) string {
	return filepath.Join(getProjectChatsPath(tenantID, projectID), conversationID)
}

func getSubclientPath(tenantID, projectID, subclientID string) string {
	return filepath.Join(getProjectPath(tenantID, projectID), "subs", subclientID)
}

func getSubclientFilesPath(tenantID, projectID, subclientID string) string {
	return filepath.Join(getSubclientPath(tenantID, projectID, subclientID), "files")
}

func getSubclientChatsPath(tenantID, projectID, subclientID string) string {
	return filepath.Join(getSubclientPath(tenantID, projectID, subclientID), "chats")
}

func getSubclientConversationPath(tenantID, projectID, subclientID, conversationID string) string {
	return filepath.Join(getSubclientChatsPath(tenantID, projectID, subclientID), conversationID)
}

// ensureProjectDirs creates the project directory structure
func ensureProjectDirs(tenantID, projectID string) error {
	paths := []string{
		getProjectPath(tenantID, projectID),
		getProjectFilesPath(tenantID, projectID),
		getProjectChatsPath(tenantID, projectID),
		getProjectWAMetaPath(tenantID, projectID),
	}

	for _, p := range paths {
		if err := os.MkdirAll(p, 0755); err != nil && !os.IsExist(err) {
			return fmt.Errorf("failed to create directory %s: %w", p, err)
		}
	}

	// Create context.md if it doesn't exist
	contextPath := filepath.Join(getProjectPath(tenantID, projectID), "context.md")
	if _, err := os.Stat(contextPath); os.IsNotExist(err) {
		if err := os.WriteFile(contextPath, []byte("# Project Context\n\nAdd your project documentation here.\n"), 0644); err != nil {
			return fmt.Errorf("failed to create context.md: %w", err)
		}
	}

	return nil
}

// ensureSubclientDirs creates the subclient directory structure
func ensureSubclientDirs(tenantID, projectID, subclientID string) error {
	paths := []string{
		getSubclientPath(tenantID, projectID, subclientID),
		getSubclientFilesPath(tenantID, projectID, subclientID),
		getSubclientChatsPath(tenantID, projectID, subclientID),
	}

	for _, p := range paths {
		if err := os.MkdirAll(p, 0755); err != nil && !os.IsExist(err) {
			return fmt.Errorf("failed to create directory %s: %w", p, err)
		}
	}

	return nil
}

// Chat and conversation types
type ChatMessage struct {
	ID        string    `json:"id"`
	Role      string    `json:"role"`       // user, assistant, system
	Content   string    `json:"content"`
	Timestamp time.Time `json:"timestamp"`
}

type Conversation struct {
	ID       string         `json:"id"`
	Title    string         `json:"title"`
	CreatedAt time.Time    `json:"created_at"`
	UpdatedAt time.Time    `json:"updated_at"`
	Messages []ChatMessage `json:"messages"`
}

// File types
type FileMetadata struct {
	Name        string    `json:"name"`
	Path        string    `json:"path"`
	Size        int64     `json:"size"`
	ContentType string    `json:"content_type"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// API types
type CreateConversationRequest struct {
	Title string `json:"title"`
}

type CreateConversationResponse struct {
	ID string `json:"id"`
}

type AddMessageRequest struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type GetConversationResponse struct {
	ID        string         `json:"id"`
	Title     string         `json:"title"`
	CreatedAt string         `json:"created_at"`
	UpdatedAt string         `json:"updated_at"`
	Messages  []ChatMessage  `json:"messages"`
}

type ListConversationsResponse struct {
	Conversations []struct {
		ID        string `json:"id"`
		Title     string `json:"title"`
		CreatedAt string `json:"created_at"`
		UpdatedAt string `json:"updated_at"`
	} `json:"conversations"`
}

type UploadFileResponse struct {
	Path string `json:"path"`
	Size int64  `json:"size"`
}

type ListFilesResponse struct {
	Files []FileMetadata `json:"files"`
}

type ContextResponse struct {
	Content string `json:"content"`
}

type UpdateContextRequest struct {
	Content string `json:"content"`
}

// Helper function to load conversation
func loadConversation(filePath string) (*Conversation, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "conversation not found"}
		}
		return nil, err
	}

	var conv Conversation
	if err := json.Unmarshal(data, &conv); err != nil {
		return nil, fmt.Errorf("failed to parse conversation: %w", err)
	}

	return &conv, nil
}

// Helper function to save conversation
func saveConversation(filePath string, conv *Conversation) error {
	data, err := json.MarshalIndent(conv, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal conversation: %w", err)
	}

	// Ensure directory exists
	if err := os.MkdirAll(filepath.Dir(filePath), 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return fmt.Errorf("failed to write conversation: %w", err)
	}

	return nil
}

// Helper to generate IDs for conversations and messages
func generateConvID() string {
	return newID("conv")
}

func generateMsgID() string {
	return newID("msg")
}

// Helper to check project ownership
func canAccessProject(ctx context.Context, tenantID, projectID string) bool {
	raw := auth.Data()
	data, ok := raw.(*AuthData)
	if !ok || data == nil {
		return false
	}

	// Must be in tenant scope to access project
	if data.ScopeType != scopeTenant {
		return false
	}

	// Must belong to the same tenant
	return data.TenantID == tenantID
}

// Helper to check subclient ownership
func canAccessSubclient(ctx context.Context, tenantID, projectID, subclientID string) bool {
	raw := auth.Data()
	data, ok := raw.(*AuthData)
	if !ok || data == nil {
		return false
	}

	// Can be in tenant or subclient scope
	if data.ScopeType == scopeTenant {
		return data.TenantID == tenantID
	}

	if data.ScopeType == scopeSubclient {
		return data.ScopeID == subclientID
	}

	return false
}

// CreateProjectConversation creates a new conversation in a project
//
//encore:api auth method=POST path=/projects/:projectID/conversations
func CreateProjectConversation(ctx context.Context, projectID string, req *CreateConversationRequest) (*CreateConversationResponse, error) {
	if req == nil || strings.TrimSpace(req.Title) == "" {
		return nil, badRequest("title is required")
	}

	raw := auth.Data()
	data, ok := raw.(*AuthData)
	if !ok || data == nil || data.ScopeType != scopeTenant {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "tenant session required"}
	}

	// Verify project exists and belongs to tenant
	ok, _, _, err := projectOwnedByTenant(ctx, projectID, data.TenantID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "project not found"}
	}

	// Ensure directories exist
	if err := ensureProjectDirs(data.TenantID, projectID); err != nil {
		return nil, err
	}

	convID := generateConvID()
	now := time.Now()

	conv := &Conversation{
		ID:        convID,
		Title:     strings.TrimSpace(req.Title),
		CreatedAt: now,
		UpdatedAt: now,
		Messages:  []ChatMessage{},
	}

	convPath := filepath.Join(getProjectChatsPath(data.TenantID, projectID), convID+".json")
	if err := saveConversation(convPath, conv); err != nil {
		return nil, err
	}

	return &CreateConversationResponse{ID: convID}, nil
}

// AddProjectMessage adds a message to a project conversation
//
//encore:api auth method=POST path=/projects/:projectID/conversations/:conversationID/messages
func AddProjectMessage(ctx context.Context, projectID, conversationID string, req *AddMessageRequest) (*ChatMessage, error) {
	if req == nil || strings.TrimSpace(req.Content) == "" || strings.TrimSpace(req.Role) == "" {
		return nil, badRequest("content and role are required")
	}

	raw := auth.Data()
	data, ok := raw.(*AuthData)
	if !ok || data == nil || data.ScopeType != scopeTenant {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "tenant session required"}
	}

	// Verify project exists
	ok, _, _, err := projectOwnedByTenant(ctx, projectID, data.TenantID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "project not found"}
	}

	convPath := filepath.Join(getProjectChatsPath(data.TenantID, projectID), conversationID+".json")
	conv, err := loadConversation(convPath)
	if err != nil {
		return nil, err
	}

	msg := ChatMessage{
		ID:        generateMsgID(),
		Role:      strings.TrimSpace(req.Role),
		Content:   strings.TrimSpace(req.Content),
		Timestamp: time.Now(),
	}

	conv.Messages = append(conv.Messages, msg)
	conv.UpdatedAt = time.Now()

	if err := saveConversation(convPath, conv); err != nil {
		return nil, err
	}

	return &msg, nil
}

// GetProjectConversation retrieves a conversation with all messages
//
//encore:api auth method=GET path=/projects/:projectID/conversations/:conversationID
func GetProjectConversation(ctx context.Context, projectID, conversationID string) (*GetConversationResponse, error) {
	raw := auth.Data()
	data, ok := raw.(*AuthData)
	if !ok || data == nil || data.ScopeType != scopeTenant {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "tenant session required"}
	}

	// Verify project exists
	ok, _, _, err := projectOwnedByTenant(ctx, projectID, data.TenantID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "project not found"}
	}

	convPath := filepath.Join(getProjectChatsPath(data.TenantID, projectID), conversationID+".json")
	conv, err := loadConversation(convPath)
	if err != nil {
		return nil, err
	}

	return &GetConversationResponse{
		ID:        conv.ID,
		Title:     conv.Title,
		CreatedAt: conv.CreatedAt.Format(time.RFC3339),
		UpdatedAt: conv.UpdatedAt.Format(time.RFC3339),
		Messages:  conv.Messages,
	}, nil
}

// ListProjectConversations lists all conversations in a project
//
//encore:api auth method=GET path=/projects/:projectID/conversations
func ListProjectConversations(ctx context.Context, projectID string) (*ListConversationsResponse, error) {
	raw := auth.Data()
	data, ok := raw.(*AuthData)
	if !ok || data == nil || data.ScopeType != scopeTenant {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "tenant session required"}
	}

	// Verify project exists
	ok, _, _, err := projectOwnedByTenant(ctx, projectID, data.TenantID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "project not found"}
	}

	chatsPath := getProjectChatsPath(data.TenantID, projectID)
	entries, err := os.ReadDir(chatsPath)
	if err != nil {
		if os.IsNotExist(err) {
			return &ListConversationsResponse{Conversations: []struct {
				ID        string `json:"id"`
				Title     string `json:"title"`
				CreatedAt string `json:"created_at"`
				UpdatedAt string `json:"updated_at"`
			}{}}, nil
		}
		return nil, err
	}

	var conversations []struct {
		ID        string `json:"id"`
		Title     string `json:"title"`
		CreatedAt string `json:"created_at"`
		UpdatedAt string `json:"updated_at"`
	}

	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".json") {
			convPath := filepath.Join(chatsPath, entry.Name())
			conv, err := loadConversation(convPath)
			if err != nil {
				continue
			}

			conversations = append(conversations, struct {
				ID        string `json:"id"`
				Title     string `json:"title"`
				CreatedAt string `json:"created_at"`
				UpdatedAt string `json:"updated_at"`
			}{
				ID:        conv.ID,
				Title:     conv.Title,
				CreatedAt: conv.CreatedAt.Format(time.RFC3339),
				UpdatedAt: conv.UpdatedAt.Format(time.RFC3339),
			})
		}
	}

	return &ListConversationsResponse{Conversations: conversations}, nil
}

// GetProjectContext retrieves the project context.md file
//
//encore:api auth method=GET path=/projects/:projectID/context
func GetProjectContext(ctx context.Context, projectID string) (*ContextResponse, error) {
	raw := auth.Data()
	data, ok := raw.(*AuthData)
	if !ok || data == nil || data.ScopeType != scopeTenant {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "tenant session required"}
	}

	// Verify project exists
	ok, _, _, err := projectOwnedByTenant(ctx, projectID, data.TenantID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "project not found"}
	}

	contextPath := filepath.Join(getProjectPath(data.TenantID, projectID), "context.md")
	content, err := os.ReadFile(contextPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "context not found"}
		}
		return nil, err
	}

	return &ContextResponse{Content: string(content)}, nil
}

// UpdateProjectContext updates the project context.md file
//
//encore:api auth method=PUT path=/projects/:projectID/context
func UpdateProjectContext(ctx context.Context, projectID string, req *UpdateContextRequest) (*ContextResponse, error) {
	if req == nil || strings.TrimSpace(req.Content) == "" {
		return nil, badRequest("content is required")
	}

	raw := auth.Data()
	data, ok := raw.(*AuthData)
	if !ok || data == nil || data.ScopeType != scopeTenant {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "tenant session required"}
	}

	// Verify project exists
	ok, _, _, err := projectOwnedByTenant(ctx, projectID, data.TenantID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "project not found"}
	}

	contextPath := filepath.Join(getProjectPath(data.TenantID, projectID), "context.md")
	if err := os.WriteFile(contextPath, []byte(req.Content), 0644); err != nil {
		return nil, err
	}

	return &ContextResponse{Content: req.Content}, nil
}

// Subclient APIs - Similar structure but under subclient scope

// CreateSubclientConversation creates a new conversation in a subclient
//
//encore:api auth method=POST path=/subclients/:subclientID/conversations
func CreateSubclientConversation(ctx context.Context, subclientID string, req *CreateConversationRequest) (*CreateConversationResponse, error) {
	if req == nil || strings.TrimSpace(req.Title) == "" {
		return nil, badRequest("title is required")
	}

	raw := auth.Data()
	data, ok := raw.(*AuthData)
	if !ok || data == nil {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "authentication required"}
	}

	// Get subclient's project and tenant
	subClient, err := q().GetSubclientFullByID(ctx, subclientID)
	if err != nil {
		return nil, &errs.Error{Code: errs.NotFound, Message: "subclient not found"}
	}

	// Verify access
	if data.ScopeType == scopeSubclient && data.ScopeID != subclientID {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "subclient not accessible"}
	}

	if data.ScopeType == scopeTenant {
		// Tenant can access all subclients under their projects
		if data.TenantID != "" {
			// Verify project belongs to tenant
			ok, _, _, err := projectOwnedByTenant(ctx, subClient.ProjectID, data.TenantID)
			if err != nil || !ok {
				return nil, &errs.Error{Code: errs.PermissionDenied, Message: "subclient not accessible"}
			}
		}
	}

	// Ensure directories exist
	if err := ensureSubclientDirs(subClient.TenantID, subClient.ProjectID, subclientID); err != nil {
		return nil, err
	}

	convID := generateConvID()
	now := time.Now()

	conv := &Conversation{
		ID:        convID,
		Title:     strings.TrimSpace(req.Title),
		CreatedAt: now,
		UpdatedAt: now,
		Messages:  []ChatMessage{},
	}

	convPath := filepath.Join(getSubclientChatsPath(subClient.TenantID, subClient.ProjectID, subclientID), convID+".json")
	if err := saveConversation(convPath, conv); err != nil {
		return nil, err
	}

	return &CreateConversationResponse{ID: convID}, nil
}

// AddSubclientMessage adds a message to a subclient conversation
//
//encore:api auth method=POST path=/subclients/:subclientID/conversations/:conversationID/messages
func AddSubclientMessage(ctx context.Context, subclientID, conversationID string, req *AddMessageRequest) (*ChatMessage, error) {
	if req == nil || strings.TrimSpace(req.Content) == "" || strings.TrimSpace(req.Role) == "" {
		return nil, badRequest("content and role are required")
	}

	raw := auth.Data()
	data, ok := raw.(*AuthData)
	if !ok || data == nil {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "authentication required"}
	}

	// Get subclient's project and tenant
	subClient, err := q().GetSubclientFullByID(ctx, subclientID)
	if err != nil {
		return nil, &errs.Error{Code: errs.NotFound, Message: "subclient not found"}
	}

	convPath := filepath.Join(getSubclientChatsPath(subClient.TenantID, subClient.ProjectID, subclientID), conversationID+".json")
	conv, err := loadConversation(convPath)
	if err != nil {
		return nil, err
	}

	msg := ChatMessage{
		ID:        generateMsgID(),
		Role:      strings.TrimSpace(req.Role),
		Content:   strings.TrimSpace(req.Content),
		Timestamp: time.Now(),
	}

	conv.Messages = append(conv.Messages, msg)
	conv.UpdatedAt = time.Now()

	if err := saveConversation(convPath, conv); err != nil {
		return nil, err
	}

	return &msg, nil
}

// GetSubclientConversation retrieves a subclient conversation
//
//encore:api auth method=GET path=/subclients/:subclientID/conversations/:conversationID
func GetSubclientConversation(ctx context.Context, subclientID, conversationID string) (*GetConversationResponse, error) {
	raw := auth.Data()
	data, ok := raw.(*AuthData)
	if !ok || data == nil {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "authentication required"}
	}

	// Get subclient's project and tenant
	subClient, err := q().GetSubclientFullByID(ctx, subclientID)
	if err != nil {
		return nil, &errs.Error{Code: errs.NotFound, Message: "subclient not found"}
	}

	convPath := filepath.Join(getSubclientChatsPath(subClient.TenantID, subClient.ProjectID, subclientID), conversationID+".json")
	conv, err := loadConversation(convPath)
	if err != nil {
		return nil, err
	}

	return &GetConversationResponse{
		ID:        conv.ID,
		Title:     conv.Title,
		CreatedAt: conv.CreatedAt.Format(time.RFC3339),
		UpdatedAt: conv.UpdatedAt.Format(time.RFC3339),
		Messages:  conv.Messages,
	}, nil
}

// ListSubclientConversations lists subclient conversations
//
//encore:api auth method=GET path=/subclients/:subclientID/conversations
func ListSubclientConversations(ctx context.Context, subclientID string) (*ListConversationsResponse, error) {
	raw := auth.Data()
	data, ok := raw.(*AuthData)
	if !ok || data == nil {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "authentication required"}
	}

	// Get subclient's project and tenant
	subClient, err := q().GetSubclientFullByID(ctx, subclientID)
	if err != nil {
		return nil, &errs.Error{Code: errs.NotFound, Message: "subclient not found"}
	}

	chatsPath := getSubclientChatsPath(subClient.TenantID, subClient.ProjectID, subclientID)
	entries, err := os.ReadDir(chatsPath)
	if err != nil {
		if os.IsNotExist(err) {
			return &ListConversationsResponse{Conversations: []struct {
				ID        string `json:"id"`
				Title     string `json:"title"`
				CreatedAt string `json:"created_at"`
				UpdatedAt string `json:"updated_at"`
			}{}}, nil
		}
		return nil, err
	}

	var conversations []struct {
		ID        string `json:"id"`
		Title     string `json:"title"`
		CreatedAt string `json:"created_at"`
		UpdatedAt string `json:"updated_at"`
	}

	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".json") {
			convPath := filepath.Join(chatsPath, entry.Name())
			conv, err := loadConversation(convPath)
			if err != nil {
				continue
			}

			conversations = append(conversations, struct {
				ID        string `json:"id"`
				Title     string `json:"title"`
				CreatedAt string `json:"created_at"`
				UpdatedAt string `json:"updated_at"`
			}{
				ID:        conv.ID,
				Title:     conv.Title,
				CreatedAt: conv.CreatedAt.Format(time.RFC3339),
				UpdatedAt: conv.UpdatedAt.Format(time.RFC3339),
			})
		}
	}

	return &ListConversationsResponse{Conversations: conversations}, nil
}
