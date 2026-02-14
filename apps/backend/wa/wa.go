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

	"encore.dev/beta/errs"
	"encore.app/backend/llm"

	waProto "go.mau.fi/whatsmeow/binary/proto"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	waevents "go.mau.fi/whatsmeow/types/events"
	walog "go.mau.fi/whatsmeow/util/log"
	"google.golang.org/protobuf/proto"

	_ "modernc.org/sqlite"
)

//encore:service
type Service struct {
	mu        sync.RWMutex
	client    *whatsmeow.Client
	store     *sqlstore.Container
	lastQR    string
	lastQRAt  time.Time
	lastError string
}

func initService() (*Service, error) {
	store, err := setupStore()
	if err != nil {
		return nil, err
	}

	logger := walog.Stdout("wa", "INFO", true)
	device, err := store.GetFirstDevice()
	if err != nil {
		return nil, fmt.Errorf("load device: %w", err)
	}

	client := whatsmeow.NewClient(device, logger)
	service := &Service{
		client: client,
		store:  store,
	}
	client.AddEventHandler(service.handleEvent)
	return service, nil
}

func setupStore() (*sqlstore.Container, error) {
	dataDir := filepath.Join("data", "services", "whatsmeow")
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, fmt.Errorf("create data dir: %w", err)
	}

	dbPath := filepath.Join(dataDir, "whatsmeow.db")
	logger := walog.Stdout("wa-store", "INFO", true)
	store, err := sqlstore.New("sqlite", dbPath+"?_foreign_keys=on", logger)
	if err != nil {
		return nil, fmt.Errorf("open store: %w", err)
	}

	return store, nil
}

func (s *Service) handleEvent(evt interface{}) {
	switch v := evt.(type) {
	case *waevents.Message:
		if v.Info.IsFromMe {
			return
		}
		text := extractText(v.Message)
		if text == "" {
			return
		}
		go s.reply(context.Background(), v.Info.Chat, text)
	case *waevents.LoggedOut:
		s.setLastError(fmt.Sprintf("logged out: %v", v.Reason))
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

func (s *Service) reply(ctx context.Context, jid types.JID, text string) {
	s.mu.RLock()
	client := s.client
	s.mu.RUnlock()

	if client == nil || !client.IsConnected() {
		return
	}

	resp, err := llm.Generate(ctx, &llm.GenerateParams{Prompt: text})
	if err != nil {
		s.setLastError(fmt.Sprintf("llm generate: %v", err))
		return
	}

	content := strings.TrimSpace(resp.Content)
	if content == "" {
		return
	}

	_, err = client.SendMessage(ctx, jid, &waProto.Message{Conversation: proto.String(content)})
	if err != nil {
		s.setLastError(fmt.Sprintf("send reply: %v", err))
	}
}

func (s *Service) setLastError(msg string) {
	if msg == "" {
		return
	}
	s.mu.Lock()
	s.lastError = msg
	s.mu.Unlock()
}

func (s *Service) updateQR(code string) {
	s.mu.Lock()
	s.lastQR = code
	s.lastQRAt = time.Now()
	s.mu.Unlock()
}

// Start connects to WhatsApp. If not logged in, it starts a QR session.
//
//encore:api public method=POST path=/wa/start
func (s *Service) Start(ctx context.Context) (*StatusResponse, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.client == nil {
		return nil, errs.New(errs.Internal, "client not initialized")
	}
	if s.client.IsConnected() {
		return s.statusLocked(), nil
	}

	if s.client.Store == nil || s.client.Store.ID == nil {
		qrChan, err := s.client.GetQRChannel(ctx)
		if err != nil {
			return nil, errs.New(errs.Internal, fmt.Sprintf("qr channel: %v", err))
		}
		go s.watchQR(qrChan)
	}

	if err := s.client.Connect(); err != nil {
		return nil, errs.New(errs.Internal, fmt.Sprintf("connect: %v", err))
	}

	return s.statusLocked(), nil
}

// Stop disconnects the WhatsApp client.
//
//encore:api public method=POST path=/wa/stop
func (s *Service) Stop(ctx context.Context) (*StatusResponse, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.client != nil && s.client.IsConnected() {
		s.client.Disconnect()
	}

	return s.statusLocked(), nil
}

// QR returns the latest QR code if login is required.
//
//encore:api public method=GET path=/wa/qr
func (s *Service) QR(ctx context.Context) (*QRResponse, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return &QRResponse{
		Code:      s.lastQR,
		UpdatedAt: s.lastQRAt,
		Connected: s.client != nil && s.client.IsConnected(),
	}, nil
}

// Status returns service and connection state.
//
//encore:api public method=GET path=/wa/status
func (s *Service) Status(ctx context.Context) (*StatusResponse, error) {
	s.mu.RLock()
	status := s.statusLocked()
	s.mu.RUnlock()

	llmStatus, err := llm.Status(ctx)
	if err == nil && llmStatus != nil {
		status.LLMReady = llmStatus.Ready
		status.LLMError = llmStatus.Error
	}

	return status, nil
}

// Send sends a text message to a WhatsApp user.
//
//encore:api public method=POST path=/wa/send
func (s *Service) Send(ctx context.Context, p *SendParams) (*SendResponse, error) {
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
	client := s.client
	s.mu.RUnlock()

	if client == nil || !client.IsConnected() {
		return nil, errs.New(errs.Unavailable, "client not connected")
	}

	msg := &waProto.Message{Conversation: proto.String(p.Message)}
	_, err = client.SendMessage(ctx, jid, msg)
	if err != nil {
		return nil, errs.New(errs.Internal, fmt.Sprintf("send failed: %v", err))
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
	LastQR    string    `json:"last_qr"`
	LastQRAt  time.Time `json:"last_qr_at"`
	LLMReady  bool      `json:"llm_ready"`
	LLMError  string    `json:"llm_error"`
	LastError string    `json:"last_error"`
}

type HealthResponse struct {
	Status string `json:"status"`
}

func (s *Service) statusLocked() *StatusResponse {
	loggedIn := false
	if s.client != nil && s.client.Store != nil && s.client.Store.ID != nil {
		loggedIn = true
	}

	return &StatusResponse{
		Connected: s.client != nil && s.client.IsConnected(),
		LoggedIn:  loggedIn,
		LastQR:    s.lastQR,
		LastQRAt:  s.lastQRAt,
		LLMReady:  false,
		LLMError:  "",
		LastError: s.lastError,
	}
}

func (s *Service) watchQR(ch <-chan whatsmeow.QRChannelItem) {
	for item := range ch {
		switch item.Event {
		case "code":
			s.updateQR(item.Code)
		case "success":
			s.updateQR("")
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
