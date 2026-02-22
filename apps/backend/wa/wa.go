package wa

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"encore.app/backend/iam"
	"encore.app/backend/llm"
	"encore.dev/beta/auth"
	"encore.dev/beta/errs"
)

const (
	// Default aimeow API URL
	DefaultAimeowURL = "http://localhost:7031/api/v1"
)

// aimeowClient represents a WhatsApp client managed by aimeow service
type aimeowClient struct {
	clientID  string
	projectID string
	tenantID  string
	lastQR    string
	lastQRAt  time.Time
	connected bool
	loggedIn  bool
	lastError string
}

//encore:service
type Service struct {
	mu      sync.RWMutex
	clients map[string]*aimeowClient // projectID -> client
	http    *http.Client
}

func initService() (*Service, error) {
	return &Service{
		clients: make(map[string]*aimeowClient),
		http:    &http.Client{Timeout: 30 * time.Second},
	}, nil
}

// getAimeowURL returns the aimeow API URL from environment or default
func (s *Service) getAimeowURL() string {
	url := os.Getenv("AIMEOW_API_URL")
	if url == "" {
		return DefaultAimeowURL
	}
	return url
}

// getOrCreateClient retrieves or creates a WhatsApp client reference for a project
func (s *Service) getOrCreateClient(projectID string) *aimeowClient {
	s.mu.Lock()
	defer s.mu.Unlock()

	if pc, exists := s.clients[projectID]; exists {
		return pc
	}

	// Create a client reference (actual client is managed by aimeow)
	pc := &aimeowClient{
		clientID:  fmt.Sprintf("proj-%s", projectID),
		projectID: projectID,
		connected: false,
		loggedIn:  false,
	}

	s.clients[projectID] = pc
	return pc
}

// Start creates a new WhatsApp client via aimeow API
//
//encore:api auth method=POST path=/projects/:projectID/wa/start
func (s *Service) Start(ctx context.Context, projectID string, req *StartRequest) (*StatusResponse, error) {
	// Get auth data
	raw := auth.Data()
	data, ok := raw.(*iam.AuthData)
	if !ok || data == nil {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "authentication required"}
	}

	// Get or create client reference
	pc := s.getOrCreateClient(projectID)
	pc.tenantID = data.TenantID

	// Call aimeow API to create client
	aimeowURL := s.getAimeowURL()
	createURL := fmt.Sprintf("%s/clients/new", aimeowURL)

	payload := map[string]interface{}{
		"id":      pc.clientID,
		"os_name": fmt.Sprintf("project-%s", projectID),
	}

	if req != nil && req.Type != "" {
		payload["type"] = req.Type
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, &errs.Error{Code: errs.Internal, Message: fmt.Sprintf("marshal request: %v", err)}
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", createURL, bytes.NewReader(body))
	if err != nil {
		return nil, &errs.Error{Code: errs.Internal, Message: fmt.Sprintf("create request: %v", err)}
	}

	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := s.http.Do(httpReq)
	if err != nil {
		pc.lastError = fmt.Sprintf("aimeow connection failed: %v", err)
		return nil, &errs.Error{Code: errs.Unavailable, Message: fmt.Sprintf("aimeow unavailable: %v", err)}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		respBody, _ := io.ReadAll(resp.Body)
		pc.lastError = fmt.Sprintf("aimeow returned %d: %s", resp.StatusCode, string(respBody))
		return nil, &errs.Error{Code: errs.Internal, Message: fmt.Sprintf("aimeow error: %s", string(respBody))}
	}

	pc.connected = true
	pc.lastError = ""

	return pc.status(), nil
}

// Stop disconnects the WhatsApp client for a project via aimeow API
//
//encore:api auth method=POST path=/projects/:projectID/wa/stop
func (s *Service) Stop(ctx context.Context, projectID string) (*StatusResponse, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	pc, exists := s.clients[projectID]
	if !exists {
		return &StatusResponse{Connected: false, LoggedIn: false}, nil
	}

	// Call aimeow API to delete client
	aimeowURL := s.getAimeowURL()
	deleteURL := fmt.Sprintf("%s/clients/%s", aimeowURL, pc.clientID)

	httpReq, err := http.NewRequestWithContext(ctx, "DELETE", deleteURL, http.NoBody)
	if err != nil {
		return nil, &errs.Error{Code: errs.Internal, Message: fmt.Sprintf("create request: %v", err)}
	}

	resp, err := s.http.Do(httpReq)
	if err != nil {
		// Log error but don't fail - client might not exist
		fmt.Printf("Failed to delete client from aimeow: %v\n", err)
	} else {
		resp.Body.Close()
	}

	// Clear client state
	pc.connected = false
	pc.loggedIn = false
	pc.lastQR = ""
	pc.lastQRAt = time.Time{}
	pc.lastError = ""

	return pc.status(), nil
}

// QR returns the latest QR code for a project
//
//encore:api auth method=GET path=/projects/:projectID/wa/qr
func (s *Service) QR(ctx context.Context, projectID string) (*QRResponse, error) {
	// Get auth data
	raw := auth.Data()
	data, ok := raw.(*iam.AuthData)
	if !ok || data == nil {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "authentication required"}
	}

	s.mu.Lock()
	pc := s.getOrCreateClient(projectID)
	pc.tenantID = data.TenantID
	s.mu.Unlock()

	// Fetch QR code from aimeow
	aimeowURL := s.getAimeowURL()
	clientURL := fmt.Sprintf("%s/clients/%s", aimeowURL, pc.clientID)

	httpReq, err := http.NewRequestWithContext(ctx, "GET", clientURL, http.NoBody)
	if err != nil {
		return nil, &errs.Error{Code: errs.Internal, Message: fmt.Sprintf("create request: %v", err)}
	}

	resp, err := s.http.Do(httpReq)
	if err != nil {
		pc.lastError = fmt.Sprintf("aimeow connection failed: %v", err)
		return &QRResponse{
			Code:      "",
			UpdatedAt: pc.lastQRAt,
			Connected: false,
		}, nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		pc.lastError = fmt.Sprintf("aimeow returned %d: %s", resp.StatusCode, string(respBody))
		return &QRResponse{
			Code:      "",
			UpdatedAt: pc.lastQRAt,
			Connected: false,
		}, nil
	}

	var clientData struct {
		QRCode    string `json:"qrCode"`
		Connected bool   `json:"connected"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&clientData); err != nil {
		pc.lastError = fmt.Sprintf("decode response: %v", err)
		return &QRResponse{
			Code:      "",
			UpdatedAt: pc.lastQRAt,
			Connected: false,
		}, nil
	}

	// Update QR code if available
	if clientData.QRCode != "" && clientData.QRCode != pc.lastQR {
		pc.lastQR = clientData.QRCode
		pc.lastQRAt = time.Now()
		pc.connected = true
		pc.loggedIn = false
		pc.lastError = ""

		// Display QR code in terminal
		fmt.Printf("\n========================================\n")
		fmt.Printf("WhatsApp QR Code - Project: %s\n", pc.projectID)
		fmt.Printf("========================================\n")
		fmt.Printf("Scan this QR code with your WhatsApp:\n")
		fmt.Printf("\n")
		fmt.Printf("%s\n", pc.lastQR)
		fmt.Printf("\n")
		fmt.Printf("1. Open WhatsApp on your phone\n")
		fmt.Printf("2. Tap Menu or Settings > Linked Devices\n")
		fmt.Printf("3. Tap 'Link a Device'\n")
		fmt.Printf("4. Scan the QR code above\n")
		fmt.Printf("========================================\n\n")
	}

	return &QRResponse{
		Code:      pc.lastQR,
		UpdatedAt: pc.lastQRAt,
		Connected: pc.connected,
	}, nil
}

// Status returns service and connection state for a project
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

	// Fetch fresh status from aimeow
	aimeowURL := s.getAimeowURL()
	clientURL := fmt.Sprintf("%s/clients/%s", aimeowURL, pc.clientID)

	httpReq, err := http.NewRequestWithContext(ctx, "GET", clientURL, http.NoBody)
	if err != nil {
		return pc.status(), nil
	}

	resp, err := s.http.Do(httpReq)
	if err != nil {
		pc.lastError = fmt.Sprintf("aimeow connection failed: %v", err)
		return pc.status(), nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return pc.status(), nil
	}

	var clientData struct {
		QRCode    string `json:"qrCode"`
		Connected bool   `json:"connected"`
		LoggedIn  bool   `json:"loggedIn"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&clientData); err != nil {
		return pc.status(), nil
	}

	// Update client state
	pc.connected = clientData.Connected
	pc.loggedIn = clientData.LoggedIn

	if clientData.QRCode != "" && clientData.QRCode != pc.lastQR {
		pc.lastQR = clientData.QRCode
		pc.lastQRAt = time.Now()
	}

	// If logged in, clear QR
	if pc.loggedIn {
		pc.lastQR = ""
	}

	status := pc.status()

	llmStatus, err := llm.Status(ctx)
	if err == nil && llmStatus != nil {
		status.LLMReady = llmStatus.Ready
		status.LLMError = llmStatus.Error
	}

	return status, nil
}

// Send sends a text message to a WhatsApp user for a specific project
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

	s.mu.RLock()
	pc, exists := s.clients[projectID]
	s.mu.RUnlock()

	if !exists || !pc.connected {
		return nil, &errs.Error{Code: errs.Unavailable, Message: "client not connected"}
	}

	// Send via aimeow API
	aimeowURL := s.getAimeowURL()
	sendURL := fmt.Sprintf("%s/clients/%s/send-message", aimeowURL, pc.clientID)

	payload := map[string]interface{}{
		"chat_id": p.To,
		"text":    p.Message,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, &errs.Error{Code: errs.Internal, Message: fmt.Sprintf("marshal request: %v", err)}
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", sendURL, bytes.NewReader(body))
	if err != nil {
		return nil, &errs.Error{Code: errs.Internal, Message: fmt.Sprintf("create request: %v", err)}
	}

	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := s.http.Do(httpReq)
	if err != nil {
		pc.lastError = fmt.Sprintf("send failed: %v", err)
		return nil, &errs.Error{Code: errs.Internal, Message: fmt.Sprintf("send failed: %v", err)}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		pc.lastError = fmt.Sprintf("send failed: %s", string(respBody))
		return nil, &errs.Error{Code: errs.Internal, Message: fmt.Sprintf("send failed: %s", string(respBody))}
	}

	return &SendResponse{Status: "ok"}, nil
}

// Health returns a basic health status
//
//encore:api public method=GET path=/wa/health
func (s *Service) Health(ctx context.Context) (*HealthResponse, error) {
	// Check if aimeow is reachable
	aimeowURL := s.getAimeowURL()
	healthURL := fmt.Sprintf("%s/health", aimeowURL)

	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	httpReq, err := http.NewRequestWithContext(ctx, "GET", healthURL, http.NoBody)
	if err != nil {
		return &HealthResponse{Status: "degraded", AimeowConnected: false}, nil
	}

	resp, err := s.http.Do(httpReq)
	if err != nil {
		return &HealthResponse{Status: "degraded", AimeowConnected: false}, nil
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		return &HealthResponse{Status: "ok", AimeowConnected: true}, nil
	}

	return &HealthResponse{Status: "degraded", AimeowConnected: false}, nil
}

// Webhook receives status updates from aimeow service
//
//encore:api public method=POST path=/wa/webhook
func (s *Service) Webhook(ctx context.Context, payload *WebhookPayload) (*WebhookResponse, error) {
	if payload == nil || payload.ClientID == "" {
		return nil, badRequest("missing client_id")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	// Find the client by clientID
	var pc *aimeowClient
	for _, client := range s.clients {
		if client.clientID == payload.ClientID {
			pc = client
			break
		}
	}

	if pc == nil {
		return &WebhookResponse{Success: true}, nil
	}

	// Update client state based on event
	switch payload.Event {
	case "connected":
		pc.connected = true
		pc.loggedIn = true
		pc.lastQR = ""
		fmt.Printf("\n✓ WhatsApp connected successfully for project: %s\n\n", pc.projectID)
	case "disconnected":
		pc.connected = false
		pc.loggedIn = false
		pc.lastError = "disconnected"
	case "qr_code":
		if payload.QRCode != "" {
			pc.lastQR = payload.QRCode
			pc.lastQRAt = time.Now()
		}
	case "qr_timeout":
		pc.lastQR = ""
	}

	return &WebhookResponse{Success: true}, nil
}

type StartRequest struct {
	Type string `json:"type"`
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
	Status          string `json:"status"`
	AimeowConnected bool   `json:"aimeow_connected"`
}

type WebhookPayload struct {
	ClientID string `json:"client_id"`
	Event    string `json:"event"`
	QRCode   string `json:"qr_code,omitempty"`
}

type WebhookResponse struct {
	Success bool `json:"success"`
}

func (pc *aimeowClient) status() *StatusResponse {
	return &StatusResponse{
		Connected: pc.connected,
		LoggedIn:  pc.loggedIn,
		ProjectID: pc.projectID,
		LastQR:    pc.lastQR,
		LastQRAt:  pc.lastQRAt,
		LLMReady:  false,
		LLMError:  "",
		LastError: pc.lastError,
	}
}

func badRequest(message string) error {
	return &errs.Error{Code: errs.InvalidArgument, Message: message}
}
