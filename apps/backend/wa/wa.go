package wa

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"encore.app/backend/iam"
	"encore.app/backend/llm"
	"encore.dev/beta/auth"
	"encore.dev/beta/errs"

	"go.mau.fi/whatsmeow"
	waProto "go.mau.fi/whatsmeow/binary/proto"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	waevents "go.mau.fi/whatsmeow/types/events"
	walog "go.mau.fi/whatsmeow/util/log"
	"google.golang.org/protobuf/proto"

	_ "modernc.org/sqlite"
)

// projectClient manages a WhatsApp client for a specific project
type projectClient struct {
	client    *whatsmeow.Client
	store     *sqlstore.Container
	projectID string
	tenantID  string
	lastQR    string
	lastQRAt  time.Time
	lastError string
}

//encore:service
type Service struct {
	mu      sync.RWMutex
	clients map[string]*projectClient // projectID -> client
}

func initService() (*Service, error) {
	return &Service{
		clients: make(map[string]*projectClient),
	}, nil
}

// getOrCreateClient retrieves or creates a WhatsApp client for a project
func (s *Service) getOrCreateClient(ctx context.Context, tenantID, projectID string) (*projectClient, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if pc, exists := s.clients[projectID]; exists {
		return pc, nil
	}

	// Create new client for this project
	store, err := setupProjectStore(ctx, tenantID, projectID)
	if err != nil {
		return nil, fmt.Errorf("setup store: %w", err)
	}

	logger := walog.Stdout(fmt.Sprintf("wa-%s", projectID), "INFO", true)
	device, err := store.GetFirstDevice(ctx)
	if err != nil {
		return nil, fmt.Errorf("load device: %w", err)
	}

	client := whatsmeow.NewClient(device, logger)
	pc := &projectClient{
		client:    client,
		store:     store,
		projectID: projectID,
		tenantID:  tenantID,
	}

	// Set up event handler with project context
	client.AddEventHandler(func(evt interface{}) {
		s.handleEvent(ctx, pc, evt)
	})

	s.clients[projectID] = pc
	return pc, nil
}

// setupProjectStore creates a WhatsApp store in the project's wa_meta directory
func setupProjectStore(ctx context.Context, tenantID, projectID string) (*sqlstore.Container, error) {
	// Get data directory from environment or default
	dataDir := os.Getenv("DATA_DIR")
	if dataDir == "" {
		exePath, err := os.Executable()
		if err != nil {
			return nil, fmt.Errorf("get executable path: %w", err)
		}
		dataDir = filepath.Join(filepath.Dir(exePath), "data")
	}

	// Build path to project's wa_meta directory
	waMetaPath := filepath.Join(dataDir, "tenants", tenantID, "projects", projectID, "wa_meta")
	if err := os.MkdirAll(waMetaPath, 0755); err != nil {
		return nil, fmt.Errorf("create wa_meta dir: %w", err)
	}

	dbPath := filepath.Join(waMetaPath, "whatsmeow.db")
	logger := walog.Stdout(fmt.Sprintf("wa-store-%s", projectID), "INFO", true)

	// Open database connection with foreign keys enabled
	// The modernc.org/sqlite driver needs _pragma parameter for foreign keys
	dsn := dbPath + "?_pragma=foreign_keys(1)"
	store, err := sqlstore.New(ctx, "sqlite", dsn, logger)
	if err != nil {
		return nil, fmt.Errorf("open store: %w", err)
	}

	return store, nil
}

func (s *Service) handleEvent(ctx context.Context, pc *projectClient, evt interface{}) {
	switch v := evt.(type) {
	case *waevents.Message:
		if v.Info.IsFromMe {
			return
		}
		text := extractText(v.Message)
		if text == "" {
			return
		}
		go s.reply(context.Background(), pc, v.Info.Chat, text)
	case *waevents.LoggedOut:
		pc.lastError = fmt.Sprintf("logged out: %v", v.Reason)
	case *waevents.ConnectFailure:
		pc.lastError = fmt.Sprintf("connection failed: %v", v.Reason)
	case *waevents.Disconnected:
		pc.lastError = fmt.Sprintf("disconnected")
	}
}

func extractText(msg *waProto.Message) string {
	if msg == nil {
		return ""
	}
	if text := strings.TrimSpace(msg.GetConversation()); text != "" {
		return text
	}
	if ext := msg.GetExtendedTextMessage(); ext != nil {
		if text := strings.TrimSpace(ext.GetText()); text != "" {
			return text
		}
	}
	if img := msg.GetImageMessage(); img != nil {
		if text := strings.TrimSpace(img.GetCaption()); text != "" {
			return text
		}
	}
	return ""
}

func (s *Service) reply(ctx context.Context, pc *projectClient, jid types.JID, text string) {
	if pc.client == nil || !pc.client.IsConnected() {
		return
	}

	// Load project context from IAM service
	projectCtx, err := s.loadProjectContext(ctx, pc.tenantID, pc.projectID)
	if err != nil {
		pc.lastError = fmt.Sprintf("load project context: %v", err)
		return
	}

	// Generate response using LLM with project context
	resp, err := llm.Generate(ctx, &llm.GenerateParams{
		Prompt:         text,
		ProjectContext: projectCtx,
	})
	if err != nil {
		pc.lastError = fmt.Sprintf("llm generate: %v", err)
		return
	}

	content := strings.TrimSpace(resp.Content)
	if content == "" {
		return
	}

	_, err = pc.client.SendMessage(ctx, jid, &waProto.Message{Conversation: proto.String(content)})
	if err != nil {
		pc.lastError = fmt.Sprintf("send reply: %v", err)
	}
}

// loadProjectContext retrieves project context for LLM
func (s *Service) loadProjectContext(ctx context.Context, tenantID, projectID string) (*llm.ProjectContext, error) {
	// Get project details from IAM
	// Note: This assumes we have a way to get project info. For now, we'll fetch the context.md
	contextResp, err := iam.GetProjectContext(ctx, projectID)
	if err != nil {
		// If no context file exists yet, use defaults
		return &llm.ProjectContext{
			ProjectID:    projectID,
			ProjectName:  projectID,
			Instructions: "You are a helpful AI assistant for this project.",
			Tone:         "professional",
			Language:     "english",
			Extensions:   []string{},
			Metadata:     map[string]string{"tenant_id": tenantID},
		}, nil
	}

	return &llm.ProjectContext{
		ProjectID:    projectID,
		ProjectName:  projectID,
		Instructions: contextResp.Content,
		Tone:         "professional",
		Language:     "english",
		Extensions:   []string{},
		Metadata:     map[string]string{"tenant_id": tenantID},
	}, nil
}

func (pc *projectClient) updateQR(code string) {
	// Be very conservative with QR updates to prevent flipping

	// Case 1: New QR code received
	if code != "" {
		// Only update if we don't have a QR yet, or this is genuinely different
		if pc.lastQR == "" || (pc.lastQR != code && len(code) > 50) {
			pc.lastQR = code
			pc.lastQRAt = time.Now()

			// Display QR code in terminal
			fmt.Printf("\n========================================\n")
			fmt.Printf("WhatsApp QR Code - Project: %s\n", pc.projectID)
			fmt.Printf("========================================\n")
			fmt.Printf("Scan this QR code with your WhatsApp:\n")
			fmt.Printf("\n")
			fmt.Printf("%s\n", code)
			fmt.Printf("\n")
			fmt.Printf("1. Open WhatsApp on your phone\n")
			fmt.Printf("2. Tap Menu or Settings > Linked Devices\n")
			fmt.Printf("3. Tap 'Link a Device'\n")
			fmt.Printf("4. Scan the QR code above\n")
			fmt.Printf("========================================\n\n")
		}
		return
	}

	// Case 2: Clear QR (empty code)
	// Only clear if we have a stored device (logged in)
	if pc.client != nil && pc.client.Store != nil && pc.client.Store.ID != nil {
		// Successfully logged in, clear the QR
		pc.lastQR = ""
		pc.lastQRAt = time.Now()
		fmt.Printf("\n✓ WhatsApp connected successfully for project: %s\n\n", pc.projectID)
	}
	// Otherwise, keep the existing QR code - don't clear it
}

// Start connects to WhatsApp for a specific project. If not logged in, it starts a QR session.
//
//encore:api auth method=POST path=/projects/:projectID/wa/start
func (s *Service) Start(ctx context.Context, projectID string) (*StatusResponse, error) {
	// Get auth data
	raw := auth.Data()
	data, ok := raw.(*iam.AuthData)
	if !ok || data == nil {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "authentication required"}
	}

	// Get or create client for this project
	pc, err := s.getOrCreateClient(ctx, data.TenantID, projectID)
	if err != nil {
		return nil, &errs.Error{Code: errs.Internal, Message: fmt.Sprintf("client init: %v", err)}
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if pc.client == nil {
		return nil, &errs.Error{Code: errs.Internal, Message: "client not initialized"}
	}
	if pc.client.IsConnected() {
		return pc.status(), nil
	}

	if pc.client.Store == nil || pc.client.Store.ID == nil {
		qrChan, err := pc.client.GetQRChannel(ctx)
		if err != nil {
			return nil, &errs.Error{Code: errs.Internal, Message: fmt.Sprintf("qr channel: %v", err)}
		}
		go pc.watchQR(qrChan)
	}

	if err := pc.client.Connect(); err != nil {
		return nil, &errs.Error{Code: errs.Internal, Message: fmt.Sprintf("connect: %v", err)}
	}

	return pc.status(), nil
}

// Stop disconnects the WhatsApp client for a project.
//
//encore:api auth method=POST path=/projects/:projectID/wa/stop
func (s *Service) Stop(ctx context.Context, projectID string) (*StatusResponse, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	pc, exists := s.clients[projectID]
	if !exists {
		return &StatusResponse{Connected: false, LoggedIn: false}, nil
	}

	if pc.client != nil {
		if pc.client.IsConnected() {
			pc.client.Disconnect()
		}

		// Clear the store ID to force new QR code on next start
		if pc.client.Store != nil {
			pc.client.Store.ID = nil
		}

		// Clear last QR code
		pc.lastQR = ""
		pc.lastQRAt = time.Time{}
	}

	return pc.status(), nil
}

// QR returns the latest QR code for a project if login is required.
//
//encore:api auth method=GET path=/projects/:projectID/wa/qr
func (s *Service) QR(ctx context.Context, projectID string) (*QRResponse, error) {
	// Get auth data
	raw := auth.Data()
	data, ok := raw.(*iam.AuthData)
	if !ok || data == nil {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "authentication required"}
	}

	// Get or create client for this project
	pc, err := s.getOrCreateClient(ctx, data.TenantID, projectID)
	if err != nil {
		return nil, &errs.Error{Code: errs.Internal, Message: fmt.Sprintf("client init: %v", err)}
	}

	return &QRResponse{
		Code:      pc.lastQR,
		UpdatedAt: pc.lastQRAt,
		Connected: pc.client != nil && pc.client.IsConnected(),
	}, nil
}

// Status returns service and connection state for a project.
//
//encore:api auth method=GET path=/projects/:projectID/wa/status
func (s *Service) Status(ctx context.Context, projectID string) (*StatusResponse, error) {
	s.mu.RLock()
	pc, exists := s.clients[projectID]
	s.mu.RUnlock()

	if !exists {
		return &StatusResponse{
			Connected: false,
			LoggedIn:  false,
			ProjectID: projectID,
		}, nil
	}

	status := pc.status()

	llmStatus, err := llm.Status(ctx)
	if err == nil && llmStatus != nil {
		status.LLMReady = llmStatus.Ready
		status.LLMError = llmStatus.Error
	}

	return status, nil
}

// Send sends a text message to a WhatsApp user for a specific project.
//
//encore:api auth method=POST path=/projects/:projectID/wa/send
func (s *Service) Send(ctx context.Context, projectID string, p *SendParams) (*SendResponse, error) {
	if p == nil {
		return nil, badRequest("missing payload")
	}
	if strings.TrimSpace(p.To) == "" {
		return nil, badRequest("to is required")
	}
	if strings.TrimSpace(p.Message) == "" {
		return nil, badRequest("message is required")
	}

	jid, err := parseJID(p.To)
	if err != nil {
		return nil, badRequest(fmt.Sprintf("invalid recipient: %v", err))
	}

	s.mu.RLock()
	pc, exists := s.clients[projectID]
	s.mu.RUnlock()

	if !exists || pc.client == nil || !pc.client.IsConnected() {
		return nil, &errs.Error{Code: errs.Unavailable, Message: "client not connected"}
	}

	msg := &waProto.Message{Conversation: proto.String(p.Message)}
	_, err = pc.client.SendMessage(ctx, jid, msg)
	if err != nil {
		return nil, &errs.Error{Code: errs.Internal, Message: fmt.Sprintf("send failed: %v", err)}
	}

	return &SendResponse{Status: "ok"}, nil
}

// Health returns a basic health status.
//
//encore:api public method=GET path=/wa/health
func (s *Service) Health(ctx context.Context) (*HealthResponse, error) {
	return &HealthResponse{Status: "ok"}, nil
}

type SendParams struct {
	To      string `json:"to"`
	Message string `json:"message"`
}

type SendResponse struct {
	Status string `json:"status"`
}

type QRResponse struct {
	Code      string    `json:"code"`
	UpdatedAt time.Time `json:"updated_at"`
	Connected bool      `json:"connected"`
}

type StatusResponse struct {
	Connected bool      `json:"connected"`
	LoggedIn  bool      `json:"logged_in"`
	ProjectID string    `json:"project_id"`
	LastQR    string    `json:"last_qr"`
	LastQRAt  time.Time `json:"last_qr_at"`
	LLMReady  bool      `json:"llm_ready"`
	LLMError  string    `json:"llm_error"`
	LastError string    `json:"last_error"`
}

type HealthResponse struct {
	Status string `json:"status"`
}

func (pc *projectClient) status() *StatusResponse {
	loggedIn := false
	if pc.client != nil && pc.client.Store != nil && pc.client.Store.ID != nil {
		loggedIn = true
	}

	// Connected = true if we have a QR code OR if we're logged in
	// This provides a more stable "connected" status
	connected := loggedIn || (pc.lastQR != "" && pc.lastQR != "\"")

	return &StatusResponse{
		Connected: connected,
		LoggedIn:  loggedIn,
		ProjectID: pc.projectID,
		LastQR:    pc.lastQR,
		LastQRAt:  pc.lastQRAt,
		LLMReady:  false,
		LLMError:  "",
		LastError: pc.lastError,
	}
}

func (pc *projectClient) watchQR(ch <-chan whatsmeow.QRChannelItem) {
	for item := range ch {
		switch item.Event {
		case "code":
			pc.updateQR(item.Code)
		case "success":
			pc.updateQR("")
		}
	}
}

func parseJID(value string) (types.JID, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return types.JID{}, errors.New("empty recipient")
	}

	jid, err := types.ParseJID(value)
	if err == nil && jid.Server != "" {
		return jid, nil
	}
	if strings.Contains(value, "@") {
		return types.JID{}, errors.New("invalid JID")
	}

	return types.NewJID(value, types.DefaultUserServer), nil
}

func badRequest(message string) error {
	return &errs.Error{Code: errs.InvalidArgument, Message: message}
}
