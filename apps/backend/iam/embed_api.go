package iam

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"time"

	"encore.dev/beta/errs"
)

// ============================================================================
// PUBLIC EMBED API - No authentication required, uses embedToken (projectId)
// ============================================================================

// EmbedProjectResponse contains project info for embed
type EmbedProjectResponse struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	ShowHistory  bool   `json:"show_history"`
	UseClientUID bool   `json:"use_client_uid"`
	TenantID     string `json:"tenant_id"` // Added for path resolution
}

// GetEmbedProject gets project info for public embed (no auth required)
//
//encore:api public method=GET path=/embed/:projectID
func GetEmbedProject(ctx context.Context, projectID string) (*EmbedProjectResponse, error) {
	// For now, return basic project info
	// The tenant and projects are stored in database, but for embed we can
	// use the file system to validate project existence

	// List all tenant directories to find the project
	tenantsDir := filepath.Join(getDataDir(), "tenants")
	tenants, err := os.ReadDir(tenantsDir)
	if err != nil {
		return nil, &errs.Error{Code: errs.NotFound, Message: "project not found"}
	}

	// Search for the project in each tenant directory
	for _, tenant := range tenants {
		if !tenant.IsDir() {
			continue
		}
		tenantID := tenant.Name()

		projectsDir := filepath.Join(tenantsDir, tenantID, "projects")
		projects, err := os.ReadDir(projectsDir)
		if err != nil {
			continue
		}

		for _, project := range projects {
			if project.Name() == projectID {
				// Found the project!
				return &EmbedProjectResponse{
					ID:           projectID,
					Name:         projectID, // Use ID as name for now
					TenantID:     tenantID,
					ShowHistory:  false,
					UseClientUID: false,
				}, nil
			}
		}
	}

	return nil, &errs.Error{Code: errs.NotFound, Message: "project not found"}
}

// EmbedListConversationsResponse lists conversations for embed
type EmbedListConversationsResponse struct {
	Conversations []struct {
		ID        string `json:"id"`
		Title     string `json:"title"`
		CreatedAt string `json:"created_at"`
	} `json:"conversations"`
}

// ListEmbedConversations lists conversations for public embed (no auth required)
//
//encore:api public method=GET path=/embed/:projectID/conversations
func ListEmbedConversations(ctx context.Context, projectID string) (*EmbedListConversationsResponse, error) {
	// Get tenantID from the project
	project, err := GetEmbedProject(ctx, projectID)
	if err != nil {
		return &EmbedListConversationsResponse{Conversations: []struct {
			ID        string `json:"id"`
			Title     string `json:"title"`
			CreatedAt string `json:"created_at"`
		}{}}, nil
	}

	// Get conversations from file system
	chatsPath := filepath.Join(getProjectPath(project.TenantID, projectID), "chats")
	entries, err := os.ReadDir(chatsPath)
	if err != nil {
		if os.IsNotExist(err) {
			return &EmbedListConversationsResponse{Conversations: []struct {
				ID        string `json:"id"`
				Title     string `json:"title"`
				CreatedAt string `json:"created_at"`
			}{}}, nil
		}
		return nil, err
	}

	var conversations []struct {
		ID        string `json:"id"`
		Title     string `json:"title"`
		CreatedAt string `json:"created_at"`
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
			}{
				ID:        conv.ID,
				Title:     conv.Title,
				CreatedAt: conv.CreatedAt.Format(time.RFC3339),
			})
		}
	}

	return &EmbedListConversationsResponse{Conversations: conversations}, nil
}

// EmbedConversationResponse gets a conversation for embed
type EmbedConversationResponse struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Messages []struct {
		ID        string `json:"id"`
		Role      string `json:"role"`
		Content   string `json:"content"`
		CreatedAt string `json:"created_at"`
	} `json:"messages"`
}

// GetEmbedConversation gets a conversation for public embed (no auth required)
//
//encore:api public method=GET path=/embed/:projectID/conversations/:conversationID
func GetEmbedConversation(ctx context.Context, projectID string, conversationID string) (*EmbedConversationResponse, error) {
	// Get tenantID from the project
	project, err := GetEmbedProject(ctx, projectID)
	if err != nil {
		return nil, &errs.Error{Code: errs.NotFound, Message: "project not found"}
	}

	// Get conversation from file
	convPath := filepath.Join(getProjectPath(project.TenantID, projectID), "chats", conversationID+".json")
	conv, err := loadConversation(convPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "conversation not found"}
		}
		return nil, err
	}

	// Convert messages
	var messages []struct {
		ID        string `json:"id"`
		Role      string `json:"role"`
		Content   string `json:"content"`
		CreatedAt string `json:"created_at"`
	}
	for _, msg := range conv.Messages {
		messages = append(messages, struct {
			ID        string `json:"id"`
			Role      string `json:"role"`
			Content   string `json:"content"`
			CreatedAt string `json:"created_at"`
		}{
			ID:        msg.ID,
			Role:      msg.Role,
			Content:   msg.Content,
			CreatedAt: msg.Timestamp.Format(time.RFC3339),
		})
	}

	return &EmbedConversationResponse{
		ID:       conv.ID,
		Title:    conv.Title,
		Messages: messages,
	}, nil
}

// EmbedCreateConversationRequest creates a conversation for embed
type EmbedCreateConversationRequest struct {
	Title string `json:"title"`
}

// EmbedCreateConversationResponse creates conversation response
type EmbedCreateConversationResponse struct {
	ID    string `json:"id"`
	Title string `json:"title"`
}

// CreateEmbedConversation creates a conversation for public embed (no auth required)
//
//encore:api public method=POST path=/embed/:projectID/conversations
func CreateEmbedConversation(ctx context.Context, projectID string, req *EmbedCreateConversationRequest) (*EmbedCreateConversationResponse, error) {
	if req == nil || strings.TrimSpace(req.Title) == "" {
		return nil, badRequest("title is required")
	}

	// Get tenantID from the project
	project, err := GetEmbedProject(ctx, projectID)
	if err != nil {
		return nil, &errs.Error{Code: errs.NotFound, Message: "project not found"}
	}

	// Ensure directories exist
	chatsPath := filepath.Join(getProjectPath(project.TenantID, projectID), "chats")
	if err := os.MkdirAll(chatsPath, 0755); err != nil {
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

	convPath := filepath.Join(chatsPath, convID+".json")
	if err := saveConversation(convPath, conv); err != nil {
		return nil, err
	}

	return &EmbedCreateConversationResponse{
		ID:    convID,
		Title: conv.Title,
	}, nil
}

// EmbedCreateMessageRequest creates a message for embed
type EmbedCreateMessageRequest struct {
	Content string `json:"content"`
	Role    string `json:"role"`
}

// EmbedCreateMessageResponse creates message response for embed
type EmbedCreateMessageResponse struct {
	Message struct {
		ID        string `json:"id"`
		Role      string `json:"role"`
		Content   string `json:"content"`
		CreatedAt string `json:"created_at"`
	} `json:"message"`
}

// CreateEmbedMessage creates a message and triggers AI response for public embed (no auth required)
//
//encore:api public method=POST path=/embed/:projectID/conversations/:conversationID/messages
func CreateEmbedMessage(ctx context.Context, projectID string, conversationID string, req *EmbedCreateMessageRequest) (*EmbedCreateMessageResponse, error) {
	if req == nil || strings.TrimSpace(req.Content) == "" {
		return nil, badRequest("content is required")
	}
	if req.Role != "user" {
		return nil, badRequest("only user messages are allowed")
	}

	// Get tenantID from the project
	project, err := GetEmbedProject(ctx, projectID)
	if err != nil {
		return nil, &errs.Error{Code: errs.NotFound, Message: "project not found"}
	}

	// Get conversation
	convPath := filepath.Join(getProjectPath(project.TenantID, projectID), "chats", conversationID+".json")
	conv, err := loadConversation(convPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "conversation not found"}
		}
		return nil, err
	}

	// Add user message
	now := time.Now()
	userMsg := ChatMessage{
		ID:        generateMsgID(),
		Role:      "user",
		Content:   strings.TrimSpace(req.Content),
		Timestamp: now,
	}
	conv.Messages = append(conv.Messages, userMsg)
	conv.UpdatedAt = now

	// Save conversation
	if err := saveConversation(convPath, conv); err != nil {
		return nil, err
	}

	// Trigger AI response (this would call the LLM - simplified for now)
	// TODO: Integrate with actual LLM service
	aiMsg := ChatMessage{
		ID:        generateMsgID(),
		Role:      "assistant",
		Content:   "This is a placeholder response. Please integrate with your LLM service.",
		Timestamp: now.Add(1 * time.Second),
	}
	conv.Messages = append(conv.Messages, aiMsg)

	// Save conversation with AI response
	if err := saveConversation(convPath, conv); err != nil {
		return nil, err
	}

	return &EmbedCreateMessageResponse{
		Message: struct {
			ID        string `json:"id"`
			Role      string `json:"role"`
			Content   string `json:"content"`
			CreatedAt string `json:"created_at"`
		}{
			ID:        aiMsg.ID,
			Role:      aiMsg.Role,
			Content:   aiMsg.Content,
			CreatedAt: aiMsg.Timestamp.Format(time.RFC3339),
		},
	}, nil
}
