package llm

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"math/big"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"encore.app/backend/iam"
	"encore.app/backend/llm/extensions"
	"encore.dev/beta/auth"
	"encore.dev/beta/errs"

	"github.com/cloudwego/eino-ext/components/model/openai"
	"github.com/cloudwego/eino/schema"
)

// Remove unused imports
var _ = os.ErrNotExist

//encore:service
type Service struct {
	defaultModel *openai.ChatModel
	defaultErr   error
	executor     extensions.Executor
	// Cache for resolved endpoints to avoid repeated DB queries
	endpointCache      map[string]*ResolvedEndpoint
	endpointCacheMutex sync.RWMutex
	endpointCacheTime  map[string]time.Time
	cacheDuration      time.Duration
	// Cache for system prompts to avoid repeated string building
	systemPromptCache      map[string]string
	systemPromptCacheMutex sync.RWMutex
	// Cache for chat models to avoid recreating them for each request
	modelCache      map[string]*openai.ChatModel
	modelCacheMutex sync.RWMutex
}

type ModelConfig struct {
	Provider string
	BaseURL  string
	APIKey   string
	Model    string
}

type Endpoint struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Provider     string `json:"provider"`
	BaseURL      string `json:"base_url"`
	Model        string `json:"model"`
	IsActive     bool   `json:"is_active"`
	HasAPIKey    bool   `json:"has_api_key"`
	APIKeyMasked string `json:"api_key_masked"`
	CreatedAt    string `json:"created_at"`
	UpdatedAt    string `json:"updated_at"`
}

type TenantAllocation struct {
	ID                string  `json:"id"`
	TenantID          string  `json:"tenant_id"`
	EndpointID        string  `json:"endpoint_id"`
	EndpointName      string  `json:"endpoint_name"`
	Provider          string  `json:"provider"`
	BaseURL           string  `json:"base_url"`
	Model             string  `json:"model"`
	AllocationPercent float64 `json:"allocation_percent"`
	Requests          int     `json:"requests"`
	TotalTokens       int     `json:"total_tokens"`
	Successful        int     `json:"successful"`
	Failed            int     `json:"failed"`
	CreatedAt         string  `json:"created_at"`
	UpdatedAt         string  `json:"updated_at"`
}

type ResolvedEndpoint struct {
	ID       string
	Name     string
	Provider string
	BaseURL  string
	APIKey   string
	Model    string
}

type CreateEndpointParams struct {
	Name     string `json:"name"`
	Provider string `json:"provider"`
	BaseURL  string `json:"base_url"`
	APIKey   string `json:"api_key"`
	Model    string `json:"model"`
	IsActive bool   `json:"is_active"`
}

type UpdateEndpointParams struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Provider string `json:"provider"`
	BaseURL  string `json:"base_url"`
	APIKey   string `json:"api_key"`
	Model    string `json:"model"`
	IsActive bool   `json:"is_active"`
}

type ListEndpointsResponse struct {
	Items []*Endpoint `json:"items"`
}

type ListTenantAllocationsParams struct {
	TenantID string `json:"tenant_id"`
	Days     int    `json:"days"`
}

type ListTenantAllocationsResponse struct {
	Items []*TenantAllocation `json:"items"`
	Total float64             `json:"total_allocation_percent"`
}

type UpsertTenantAllocationParams struct {
	TenantID          string  `json:"tenant_id"`
	EndpointID        string  `json:"endpoint_id"`
	AllocationPercent float64 `json:"allocation_percent"`
}

func initService() (*Service, error) {
	ctx := context.Background()
	cfg := defaultConfig()
	model, err := newChatModel(ctx, cfg)
	executor := extensions.NewGojaExecutor("")
	return &Service{
		defaultModel:          model,
		defaultErr:            err,
		executor:              executor,
		endpointCache:         make(map[string]*ResolvedEndpoint),
		endpointCacheTime:     make(map[string]time.Time),
		cacheDuration:         10 * time.Minute, // Increased from 5 to 10 minutes for better performance
		systemPromptCache:     make(map[string]string),
		systemPromptCacheMutex: sync.RWMutex{},
		modelCache:            make(map[string]*openai.ChatModel),
		modelCacheMutex:        sync.RWMutex{},
	}, nil
}

func defaultConfig() *ModelConfig {
	return &ModelConfig{
		Provider: "openai-compatible",
		APIKey:   strings.TrimSpace(os.Getenv("OPENAI_API_KEY")),
		Model:    firstNonEmpty(strings.TrimSpace(os.Getenv("OPENAI_MODEL")), "gpt-4o-mini"),
		BaseURL:  strings.TrimSpace(os.Getenv("OPENAI_BASE_URL")),
	}
}

func newChatModel(ctx context.Context, cfg *ModelConfig) (*openai.ChatModel, error) {
	if cfg == nil || strings.TrimSpace(cfg.APIKey) == "" {
		return nil, errors.New("OPENAI_API_KEY is not set")
	}

	// Create model with optimized parameters for complete responses
	// Increased max_tokens to ensure long responses are not truncated
	maxTokens := 4096 // Increased to 4096 to prevent responses from being cut off
	temperature := float32(0.7)

	fmt.Printf("[LLM] Creating new ChatModel: model=%s, baseURL=%s, maxTokens=%d, temperature=%.1f\n",
		cfg.Model, cfg.BaseURL, maxTokens, temperature)

	chatModel, err := openai.NewChatModel(ctx, &openai.ChatModelConfig{
		APIKey:  cfg.APIKey,
		Model:   cfg.Model,
		BaseURL: cfg.BaseURL,
		// Configuration for complete responses:
		// - Max tokens at 4096 to handle long lists, detailed explanations without truncation
		// - Temperature 0.7 for balanced creativity
		MaxTokens:   &maxTokens,
		Temperature: &temperature,
	})
	if err != nil {
		return nil, fmt.Errorf("init llm: %w", err)
	}
	fmt.Printf("[LLM] ChatModel created successfully\n")
	return chatModel, nil
}

func boolToInt(v bool) int {
	if v {
		return 1
	}
	return 0
}

func intToBool(v int) bool {
	return v != 0
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

func maskSecret(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}
	if len(s) <= 4 {
		return "****"
	}
	return strings.Repeat("*", len(s)-4) + s[len(s)-4:]
}

func requireSystemRole() error {
	raw := auth.Data()
	data, ok := raw.(*iam.AuthData)
	if !ok || data == nil {
		return &errs.Error{Code: errs.Unauthenticated, Message: "not authenticated"}
	}
	if string(data.Role) != "system" {
		return &errs.Error{Code: errs.PermissionDenied, Message: "system role required"}
	}
	return nil
}

func getDB() (*sql.DB, error) {
	return iam.GetDB()
}

func nowRFC3339() string {
	return time.Now().UTC().Format(time.RFC3339)
}

func normalizeProvider(p string) string {
	p = strings.TrimSpace(strings.ToLower(p))
	if p == "" {
		return "openai-compatible"
	}
	return p
}

func toConfig(e *ResolvedEndpoint) *ModelConfig {
	if e == nil {
		return defaultConfig()
	}
	return &ModelConfig{
		Provider: normalizeProvider(e.Provider),
		BaseURL:  strings.TrimSpace(e.BaseURL),
		APIKey:   strings.TrimSpace(e.APIKey),
		Model:    firstNonEmpty(strings.TrimSpace(e.Model), "gpt-4o-mini"),
	}
}

func generateWithConfig(ctx context.Context, cfg *ModelConfig, messages []*schema.Message) (*schema.Message, error) {
	chatModel, err := newChatModel(ctx, cfg)
	if err != nil {
		return nil, err
	}
	return chatModel.Generate(ctx, messages)
}

// generateWithConfigCached uses cached models to avoid recreating them for each request
func (s *Service) generateWithConfigCached(ctx context.Context, cfg *ModelConfig, messages []*schema.Message) (*schema.Message, error) {
	// Add timeout to prevent hanging - increased to 60s for reliability
	// The LLM API needs time to process, but we don't want to wait forever
	ctx, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()

	// Create cache key from config
	key := fmt.Sprintf("%s|%s|%s", cfg.Provider, cfg.BaseURL, cfg.Model)

	// Try cache first with validation
	s.modelCacheMutex.RLock()
	cached, ok := s.modelCache[key]
	s.modelCacheMutex.RUnlock()

	if ok && cached != nil {
		// Try using cached model first with retry for rate limits
		resp, err := s.generateWithRetry(ctx, cached, messages)
		if err == nil {
			// Cache hit - return successful response
			return resp, nil
		}
		// Check if it's a rate limit error - don't delete cache for rate limits
		if !isRateLimitError(err) {
			// Cached model failed - remove it and create a new one
			fmt.Printf("[WARN] Cached model failed (key=%s): %v - recreating...\n", key, err)
			s.modelCacheMutex.Lock()
			delete(s.modelCache, key)
			s.modelCacheMutex.Unlock()
		}
	}

	// Create new model (not cached or cached failed)
	chatModel, err := newChatModel(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("create chat model: %w", err)
	}

	// Generate with new model (with retry for rate limits)
	resp, err := s.generateWithRetry(ctx, chatModel, messages)
	if err != nil {
		return nil, fmt.Errorf("generate: %w", err)
	}

	// Store in cache for future use
	s.modelCacheMutex.Lock()
	s.modelCache[key] = chatModel
	s.modelCacheMutex.Unlock()

	return resp, nil
}

// generateWithRetry attempts to generate with retry on rate limit errors
func (s *Service) generateWithRetry(ctx context.Context, chatModel *openai.ChatModel, messages []*schema.Message) (*schema.Message, error) {
	maxRetries := 3
	baseDelay := 2 * time.Second // Start with 2 seconds

	// Log the request details for debugging
	fmt.Printf("[LLM] generateWithRetry: starting with %d messages\n", len(messages))
	for i, msg := range messages {
		fmt.Printf("[LLM]   Message %d: role=%s, content_length=%d\n", i, msg.Role, len(msg.Content))
		if i == 0 {
			fmt.Printf("[LLM]   System prompt (first 200 chars): %s...\n", truncateString(msg.Content, 200))
		}
	}

	for attempt := 0; attempt <= maxRetries; attempt++ {
		if attempt > 0 {
			fmt.Printf("[LLM] generateWithRetry: attempt %d/%d\n", attempt, maxRetries+1)
		}

		startCall := time.Now()
		resp, err := chatModel.Generate(ctx, messages)
		callDuration := time.Since(startCall)

		if err == nil {
			fmt.Printf("[LLM] generateWithRetry: SUCCESS in %v (attempt %d)\n", callDuration, attempt+1)
			fmt.Printf("[LLM] Response: role=%s, content_length=%d, truncated=%s\n",
				resp.Role, len(resp.Content), truncateString(resp.Content, 100))
			return resp, nil
		}

		fmt.Printf("[LLM] generateWithRetry: FAILED after %v (attempt %d): %v\n", callDuration, attempt+1, err)

		// Check if it's a rate limit error (429)
		if !isRateLimitError(err) {
			// Not a rate limit error - don't retry
			return nil, err
		}

		// Rate limit detected - wait and retry
		if attempt < maxRetries {
			waitTime := baseDelay * time.Duration(1<<attempt) // Exponential backoff: 2s, 4s, 8s
			fmt.Printf("[WARN] Rate limit detected (attempt %d/%d), waiting %v before retry...\n",
				attempt+1, maxRetries+1, waitTime)

			select {
			case <-time.After(waitTime):
				// Continue to next retry
			case <-ctx.Done():
				return nil, fmt.Errorf("rate limit retry cancelled: %w", ctx.Err())
			}
		} else {
			return nil, fmt.Errorf("rate limit: max retries (%d) exceeded: %w", maxRetries, err)
		}
	}

	return nil, fmt.Errorf("rate limit: failed after %d retries", maxRetries+1)
}

// truncateString truncates a string to max length and adds "..." if truncated
func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}

// isRateLimitError checks if an error is a rate limit error
func isRateLimitError(err error) bool {
	if err == nil {
		return false
	}

	errStr := strings.ToLower(err.Error())

	// Check for various rate limit indicators
	rateLimitIndicators := []string{
		"429",
		"rate limit",
		"too many requests",
		"quota exceeded",
		"ratelimit",
		"rate-limited",
	}

	for _, indicator := range rateLimitIndicators {
		if strings.Contains(errStr, indicator) {
			return true
		}
	}

	return false
}

// CreateEndpoint creates a managed LLM endpoint.
//
//encore:api auth method=POST path=/llm/endpoints
func (s *Service) CreateEndpoint(ctx context.Context, p *CreateEndpointParams) (*Endpoint, error) {
	if err := requireSystemRole(); err != nil {
		return nil, err
	}
	if p == nil {
		return nil, badRequest("request body required")
	}
	name := strings.TrimSpace(p.Name)
	apiKey := strings.TrimSpace(p.APIKey)
	model := strings.TrimSpace(p.Model)
	if name == "" || apiKey == "" || model == "" {
		return nil, badRequest("name, api_key, and model are required")
	}

	db, err := getDB()
	if err != nil {
		return nil, err
	}

	now := nowRFC3339()
	id := "lep_" + randomHex(10)
	endpoint := &Endpoint{}
	err = db.QueryRowContext(ctx, `
		INSERT INTO llm_endpoints (id, name, provider, base_url, api_key, model, is_active, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		RETURNING id, name, provider, COALESCE(base_url, ''), model, is_active, created_at, updated_at
	`, id, name, normalizeProvider(p.Provider), strings.TrimSpace(p.BaseURL), apiKey, model, boolToInt(p.IsActive), now, now).Scan(
		&endpoint.ID,
		&endpoint.Name,
		&endpoint.Provider,
		&endpoint.BaseURL,
		&endpoint.Model,
		&endpoint.IsActive,
		&endpoint.CreatedAt,
		&endpoint.UpdatedAt,
	)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "unique") {
			return nil, &errs.Error{Code: errs.AlreadyExists, Message: "endpoint name already exists"}
		}
		return nil, err
	}
	endpoint.HasAPIKey = true
	endpoint.APIKeyMasked = maskSecret(apiKey)
	return endpoint, nil
}

// UpdateEndpoint updates a managed LLM endpoint.
//
//encore:api auth method=PUT path=/llm/endpoints
func (s *Service) UpdateEndpoint(ctx context.Context, p *UpdateEndpointParams) (*Endpoint, error) {
	if err := requireSystemRole(); err != nil {
		return nil, err
	}
	if p == nil || strings.TrimSpace(p.ID) == "" {
		return nil, badRequest("id is required")
	}

	db, err := getDB()
	if err != nil {
		return nil, err
	}

	var oldAPIKey string
	err = db.QueryRowContext(ctx, `SELECT api_key FROM llm_endpoints WHERE id = ?`, strings.TrimSpace(p.ID)).Scan(&oldAPIKey)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "endpoint not found"}
		}
		return nil, err
	}

	apiKey := strings.TrimSpace(p.APIKey)
	if apiKey == "" {
		apiKey = oldAPIKey
	}
	now := nowRFC3339()

	endpoint := &Endpoint{}
	err = db.QueryRowContext(ctx, `
		UPDATE llm_endpoints
		SET
			name = CASE WHEN ? = '' THEN name ELSE ? END,
			provider = CASE WHEN ? = '' THEN provider ELSE ? END,
			base_url = CASE WHEN ? = '' THEN base_url ELSE ? END,
			api_key = ?,
			model = CASE WHEN ? = '' THEN model ELSE ? END,
			is_active = ?,
			updated_at = ?
		WHERE id = ?
		RETURNING id, name, provider, COALESCE(base_url, ''), model, is_active, created_at, updated_at
	`,
		strings.TrimSpace(p.Name), strings.TrimSpace(p.Name),
		normalizeProvider(p.Provider), normalizeProvider(p.Provider),
		strings.TrimSpace(p.BaseURL), strings.TrimSpace(p.BaseURL),
		apiKey,
		strings.TrimSpace(p.Model), strings.TrimSpace(p.Model),
		boolToInt(p.IsActive),
		now,
		strings.TrimSpace(p.ID),
	).Scan(
		&endpoint.ID,
		&endpoint.Name,
		&endpoint.Provider,
		&endpoint.BaseURL,
		&endpoint.Model,
		&endpoint.IsActive,
		&endpoint.CreatedAt,
		&endpoint.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "endpoint not found"}
		}
		if strings.Contains(strings.ToLower(err.Error()), "unique") {
			return nil, &errs.Error{Code: errs.AlreadyExists, Message: "endpoint name already exists"}
		}
		return nil, err
	}
	endpoint.HasAPIKey = strings.TrimSpace(apiKey) != ""
	endpoint.APIKeyMasked = maskSecret(apiKey)
	return endpoint, nil
}

// ListEndpoints returns all managed LLM endpoints.
//
//encore:api auth method=GET path=/llm/endpoints
func (s *Service) ListEndpoints(ctx context.Context) (*ListEndpointsResponse, error) {
	if err := requireSystemRole(); err != nil {
		return nil, err
	}

	db, err := getDB()
	if err != nil {
		return nil, err
	}

	rows, err := db.QueryContext(ctx, `
		SELECT id, name, provider, COALESCE(base_url, ''), model, is_active, created_at, updated_at, api_key
		FROM llm_endpoints
		ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]*Endpoint, 0)
	for rows.Next() {
		item := &Endpoint{}
		var isActive int
		var apiKey string
		if err := rows.Scan(&item.ID, &item.Name, &item.Provider, &item.BaseURL, &item.Model, &isActive, &item.CreatedAt, &item.UpdatedAt, &apiKey); err != nil {
			return nil, err
		}
		item.IsActive = intToBool(isActive)
		item.HasAPIKey = strings.TrimSpace(apiKey) != ""
		item.APIKeyMasked = maskSecret(apiKey)
		items = append(items, item)
	}
	if rows.Err() != nil {
		return nil, rows.Err()
	}

	return &ListEndpointsResponse{Items: items}, nil
}

// DeleteEndpoint deletes a managed endpoint if it is not referenced by tenant allocations.
//
//encore:api auth method=DELETE path=/llm/endpoints/:id
func (s *Service) DeleteEndpoint(ctx context.Context, id string) error {
	if err := requireSystemRole(); err != nil {
		return err
	}
	id = strings.TrimSpace(id)
	if id == "" {
		return badRequest("id is required")
	}

	db, err := getDB()
	if err != nil {
		return err
	}

	var inUse int
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM tenant_llm_allocations WHERE endpoint_id = ?`, id).Scan(&inUse); err != nil {
		return err
	}
	if inUse > 0 {
		return &errs.Error{Code: errs.FailedPrecondition, Message: "endpoint is assigned to tenant allocations"}
	}

	res, err := db.ExecContext(ctx, `DELETE FROM llm_endpoints WHERE id = ?`, id)
	if err != nil {
		return err
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return &errs.Error{Code: errs.NotFound, Message: "endpoint not found"}
	}
	return nil
}

// ListTenantAllocations lists tenant endpoint allocations and usage breakdown.
//
//encore:api auth method=GET path=/llm/tenant-allocations
func (s *Service) ListTenantAllocations(ctx context.Context, p *ListTenantAllocationsParams) (*ListTenantAllocationsResponse, error) {
	if err := requireSystemRole(); err != nil {
		return nil, err
	}
	if p == nil || strings.TrimSpace(p.TenantID) == "" {
		return nil, badRequest("tenant_id is required")
	}

	db, err := getDB()
	if err != nil {
		return nil, err
	}

	rows, err := db.QueryContext(ctx, `
		SELECT
			a.id,
			a.tenant_id,
			a.endpoint_id,
			e.name,
			e.provider,
			COALESCE(e.base_url, ''),
			e.model,
			a.allocation_percent,
			a.created_at,
			a.updated_at
		FROM tenant_llm_allocations a
		JOIN llm_endpoints e ON e.id = a.endpoint_id
		WHERE a.tenant_id = ?
		ORDER BY a.allocation_percent DESC, a.created_at ASC
	`, strings.TrimSpace(p.TenantID))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]*TenantAllocation, 0)
	total := 0.0
	for rows.Next() {
		item := &TenantAllocation{}
		if err := rows.Scan(
			&item.ID,
			&item.TenantID,
			&item.EndpointID,
			&item.EndpointName,
			&item.Provider,
			&item.BaseURL,
			&item.Model,
			&item.AllocationPercent,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		total += item.AllocationPercent
		items = append(items, item)
	}
	if rows.Err() != nil {
		return nil, rows.Err()
	}

	return &ListTenantAllocationsResponse{Items: items, Total: total}, nil
}

// UpsertTenantAllocation upserts one tenant allocation for an endpoint.
//
//encore:api auth method=PUT path=/llm/tenant-allocations
func (s *Service) UpsertTenantAllocation(ctx context.Context, p *UpsertTenantAllocationParams) (*TenantAllocation, error) {
	if err := requireSystemRole(); err != nil {
		return nil, err
	}
	if p == nil || strings.TrimSpace(p.TenantID) == "" || strings.TrimSpace(p.EndpointID) == "" {
		return nil, badRequest("tenant_id and endpoint_id are required")
	}
	if p.AllocationPercent < 0 || p.AllocationPercent > 100 {
		return nil, badRequest("allocation_percent must be between 0 and 100")
	}

	db, err := getDB()
	if err != nil {
		return nil, err
	}

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var endpointExists int
	if err := tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM llm_endpoints WHERE id = ? AND is_active = 1`, strings.TrimSpace(p.EndpointID)).Scan(&endpointExists); err != nil {
		return nil, err
	}
	if endpointExists == 0 {
		return nil, &errs.Error{Code: errs.NotFound, Message: "active endpoint not found"}
	}

	now := nowRFC3339()
	_, err = tx.ExecContext(ctx, `
		INSERT INTO tenant_llm_allocations (id, tenant_id, endpoint_id, allocation_percent, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT (tenant_id, endpoint_id)
		DO UPDATE SET allocation_percent = excluded.allocation_percent, updated_at = excluded.updated_at
	`, "tla_"+randomHex(10), strings.TrimSpace(p.TenantID), strings.TrimSpace(p.EndpointID), p.AllocationPercent, now, now)
	if err != nil {
		return nil, err
	}

	var total float64
	if err := tx.QueryRowContext(ctx, `SELECT COALESCE(SUM(allocation_percent), 0) FROM tenant_llm_allocations WHERE tenant_id = ?`, strings.TrimSpace(p.TenantID)).Scan(&total); err != nil {
		return nil, err
	}
	if total > 100.00001 {
		return nil, badRequest(fmt.Sprintf("allocation exceeds 100%% (current total %.2f%%)", total))
	}

	item := &TenantAllocation{}
	if err := tx.QueryRowContext(ctx, `
		SELECT
			a.id,
			a.tenant_id,
			a.endpoint_id,
			e.name,
			e.provider,
			COALESCE(e.base_url, ''),
			e.model,
			a.allocation_percent,
			a.created_at,
			a.updated_at
		FROM tenant_llm_allocations a
		JOIN llm_endpoints e ON e.id = a.endpoint_id
		WHERE a.tenant_id = ? AND a.endpoint_id = ?
	`, strings.TrimSpace(p.TenantID), strings.TrimSpace(p.EndpointID)).Scan(
		&item.ID,
		&item.TenantID,
		&item.EndpointID,
		&item.EndpointName,
		&item.Provider,
		&item.BaseURL,
		&item.Model,
		&item.AllocationPercent,
		&item.CreatedAt,
		&item.UpdatedAt,
	); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return item, nil
}

func ResolveEndpointForTenant(ctx context.Context, tenantID string) (*ResolvedEndpoint, error) {
	tenantID = strings.TrimSpace(tenantID)
	if tenantID == "" {
		return nil, nil
	}

	// Try to return from cache first (this is the optimization)
	// Note: We can't access s.endpointCache from this package-level function
	// So we'll do the caching at the call site in Generate method

	return resolveEndpointFromDB(ctx, tenantID)
}

func resolveEndpointFromDB(ctx context.Context, tenantID string) (*ResolvedEndpoint, error) {
	tenantID = strings.TrimSpace(tenantID)
	if tenantID == "" {
		return nil, nil
	}

	db, err := getDB()
	if err != nil {
		return nil, err
	}

	rows, err := db.QueryContext(ctx, `
		SELECT
			e.id,
			e.name,
			e.provider,
			COALESCE(e.base_url, ''),
			e.api_key,
			e.model,
			a.allocation_percent
		FROM tenant_llm_allocations a
		JOIN llm_endpoints e ON e.id = a.endpoint_id
		WHERE a.tenant_id = ? AND e.is_active = 1 AND a.allocation_percent > 0
		ORDER BY a.updated_at DESC
	`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type candidate struct {
		endpoint ResolvedEndpoint
		weight   float64
	}

	candidates := make([]candidate, 0)
	totalWeight := 0.0
	for rows.Next() {
		var c candidate
		if err := rows.Scan(
			&c.endpoint.ID,
			&c.endpoint.Name,
			&c.endpoint.Provider,
			&c.endpoint.BaseURL,
			&c.endpoint.APIKey,
			&c.endpoint.Model,
			&c.weight,
		); err != nil {
			return nil, err
		}
		if c.weight <= 0 {
			continue
		}
		totalWeight += c.weight
		candidates = append(candidates, c)
	}
	if rows.Err() != nil {
		return nil, rows.Err()
	}
	if len(candidates) == 0 || totalWeight <= 0 {
		return nil, nil
	}

	draw, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return nil, err
	}
	target := (float64(draw.Int64()) / 1_000_000.0) * totalWeight
	running := 0.0
	for _, c := range candidates {
		running += c.weight
		if target < running || math.Abs(target-running) < 1e-9 {
			selected := c.endpoint
			return &selected, nil
		}
	}
	selected := candidates[len(candidates)-1].endpoint
	return &selected, nil
}

// getCachedEndpoint returns a cached endpoint if available and fresh
func (s *Service) getCachedEndpoint(tenantID string) *ResolvedEndpoint {
	s.endpointCacheMutex.RLock()
	defer s.endpointCacheMutex.RUnlock()

	if cached, ok := s.endpointCache[tenantID]; ok {
		if cacheTime, ok := s.endpointCacheTime[tenantID]; ok {
			if time.Since(cacheTime) < s.cacheDuration {
				return cached
			}
		}
	}
	return nil
}

// setCachedEndpoint stores an endpoint in the cache
func (s *Service) setCachedEndpoint(tenantID string, endpoint *ResolvedEndpoint) {
	s.endpointCacheMutex.Lock()
	defer s.endpointCacheMutex.Unlock()

	s.endpointCache[tenantID] = endpoint
	s.endpointCacheTime[tenantID] = time.Now()
}

// GenerateStream runs a single prompt and streams the model response.
//
//encore:api public method=POST path=/llm/generate/stream
func (s *Service) GenerateStream(ctx context.Context, p *GenerateParams) (*GenerateStreamResponse, error) {
	if p == nil || strings.TrimSpace(p.Prompt) == "" {
		return nil, badRequest("prompt is required")
	}
	if p.ProjectContext == nil {
		return nil, badRequest("project_context is required")
	}

	tenantID := ""
	if p.ProjectContext.Metadata != nil {
		tenantID = strings.TrimSpace(p.ProjectContext.Metadata["tenant_id"])
	}

	// Try cache first for faster responses
	var resolved *ResolvedEndpoint
	if tenantID != "" {
		resolved = s.getCachedEndpoint(tenantID)
	}
	if resolved == nil {
		var err error
		resolved, err = resolveEndpointFromDB(ctx, tenantID)
		if err != nil {
			return nil, &errs.Error{Code: errs.Internal, Message: fmt.Sprintf("resolve llm endpoint failed: %v", err)}
		}
		// Cache for future requests
		if tenantID != "" && resolved != nil {
			s.setCachedEndpoint(tenantID, resolved)
		}
	}
	cfg := toConfig(resolved)
	if strings.TrimSpace(cfg.APIKey) == "" {
		if s.defaultErr != nil || s.defaultModel == nil {
			return nil, &errs.Error{Code: errs.Unavailable, Message: "llm not configured"}
		}
		cfg = defaultConfig()
	}

	// Build system prompt from project context (cached)
	systemPrompt := s.buildSystemPromptCached(p.ProjectContext)

	// Execute pre-generate extension hooks (skip if no extensions for speed)
	preprocessed := p.Prompt
	if p.ProjectContext.Extensions != nil && len(p.ProjectContext.Extensions) > 0 {
		preprocessed = s.applyExtensionHooks(ctx, "pre-generate", preprocessed, p.ProjectContext)
	}

	// Check if Image extension is enabled
	hasImageExtension := false
	fmt.Printf("[LLM Stream] === MULTIMODAL DEBUG ===\n")
	fmt.Printf("[LLM Stream] Checking extensions: %+v (total: %d)\n", p.ProjectContext.Extensions, len(p.ProjectContext.Extensions))
	if p.ProjectContext.Extensions != nil {
		for _, extID := range p.ProjectContext.Extensions {
			fmt.Printf("[LLM Stream]   - Extension: '%s' (equals 'image': %v)\n", extID, extID == "image")
			if extID == "image" {
				hasImageExtension = true
				fmt.Printf("[LLM Stream]   ✓ Image extension FOUND!\n")
				break
			}
		}
	}
	fmt.Printf("[LLM Stream] hasImageExtension: %v, attachments count: %d\n", hasImageExtension, len(p.Attachments))
	for i, att := range p.Attachments {
		fmt.Printf("[LLM Stream]   Attachment %d: %s (type: %s, dataSize: %d)\n", i, att.Name, att.Type, len(att.Data))
	}
	fmt.Printf("[LLM Stream] === END MULTIMODAL DEBUG ===\n")

	// Build messages - handle multimodal content if attachments exist
	var messages []*schema.Message

	// System message
	messages = append(messages, &schema.Message{
		Role:    schema.System,
		Content: systemPrompt,
	})

	// User message with potential multimodal content
	if len(p.Attachments) > 0 && hasImageExtension {
		fmt.Printf("[LLM] Processing %d file attachments (stream) with multimodal content\n", len(p.Attachments))

		// Check if there are any image attachments
		hasImages := false
		for _, att := range p.Attachments {
			if strings.HasPrefix(att.Type, "image/") && att.Data != "" {
				hasImages = true
				break
			}
		}

		if hasImages {
			// Build multimodal message with text + images
			var parts []schema.MessageInputPart

			// Add text part
			parts = append(parts, schema.MessageInputPart{
				Type: schema.ChatMessagePartTypeText,
				Text: preprocessed,
			})

			// Add image parts
			for _, att := range p.Attachments {
				if strings.HasPrefix(att.Type, "image/") && att.Data != "" {
					fmt.Printf("[LLM] Stream - Adding image: %s (%s)\n", att.Name, att.Type)
					parts = append(parts, schema.MessageInputPart{
						Type: schema.ChatMessagePartTypeImageURL,
						Image: &schema.MessageInputImage{
							MessagePartCommon: schema.MessagePartCommon{
								Base64Data: &att.Data,
								MIMEType:   att.Type,
							},
							Detail: schema.ImageURLDetailAuto,
						},
					})
				} else if att.Type != "" {
					// Non-image file - add as text reference
					parts[0].Text += fmt.Sprintf("\n\n[File Attachment: %s (%s)]", att.Name, att.Type)
				}
			}

			messages = append(messages, &schema.Message{
				Role:                   schema.User,
				UserInputMultiContent: parts,
			})
		} else {
			// No images, just add file references as text
			var fileContext strings.Builder
			for _, att := range p.Attachments {
				fileContext.WriteString(fmt.Sprintf("\n\n[File Attachment: %s (%s)]", att.Name, att.Type))
			}
			messages = append(messages, &schema.Message{
				Role:    schema.User,
				Content: preprocessed + fileContext.String(),
			})
		}
	} else {
		// No attachments or image extension not enabled - use simple text message
		if len(p.Attachments) > 0 {
			fmt.Printf("[LLM] Stream - Image extension not enabled\n")
		}
		messages = append(messages, &schema.Message{
			Role:    schema.User,
			Content: preprocessed,
		})
	}

	// For streaming, we'll generate the full response first
	// In a future enhancement, this could use true streaming with the eino library
	resp, err := s.generateWithConfigCached(ctx, cfg, messages)
	if err != nil {
		return nil, &errs.Error{Code: errs.Internal, Message: fmt.Sprintf("generate failed: %v", err)}
	}

	content := strings.TrimSpace(resp.Content)
	if p.ProjectContext.Extensions != nil && len(p.ProjectContext.Extensions) > 0 {
		content = s.applyExtensionHooks(ctx, "post-generate", content, p.ProjectContext)
	}

	// Process tool calls if extension-creator is enabled
	if p.ProjectContext.Extensions != nil {
		for _, extID := range p.ProjectContext.Extensions {
			if extID == "extension-creator" {
				var messages []string
				content, messages, _ = s.processToolCalls(ctx, content, p.ProjectContext)
				if len(messages) > 0 {
					fmt.Printf("[LLM] Tool call messages: %v\n", messages)
				}
				break
			}
		}
	}

	return &GenerateStreamResponse{Content: content}, nil
}

// Generate runs a single prompt and returns the model response.
//
//encore:api public method=POST path=/llm/generate
func (s *Service) Generate(ctx context.Context, p *GenerateParams) (*GenerateResponse, error) {
	startTime := time.Now()

	if p == nil || strings.TrimSpace(p.Prompt) == "" {
		return nil, badRequest("prompt is required")
	}
	if p.ProjectContext == nil {
		return nil, badRequest("project_context is required")
	}

	// Fast response for simple greetings (bypass LLM for common greetings)
	promptLower := strings.ToLower(strings.TrimSpace(p.Prompt))
	if isSimpleGreeting(promptLower) {
		fmt.Printf("[LLM] Fast greeting detected, responding immediately\n")
		return &GenerateResponse{Content: getGreetingResponse(promptLower)}, nil
	}

	validationTime := time.Since(startTime)
	fmt.Printf("[LLM] Generate: validation took %v\n", validationTime)

	// Check if Image extension is enabled
	hasImageExtension := false
	fmt.Printf("[LLM] === MULTIMODAL DEBUG ===\n")
	fmt.Printf("[LLM] Checking extensions: %+v (total: %d)\n", p.ProjectContext.Extensions, len(p.ProjectContext.Extensions))
	if p.ProjectContext.Extensions != nil {
		for _, extID := range p.ProjectContext.Extensions {
			fmt.Printf("[LLM]   - Extension: '%s' (equals 'image': %v)\n", extID, extID == "image")
			if extID == "image" {
				hasImageExtension = true
				fmt.Printf("[LLM]   ✓ Image extension FOUND!\n")
				break
			}
		}
	}
	fmt.Printf("[LLM] hasImageExtension: %v, attachments count: %d\n", hasImageExtension, len(p.Attachments))
	for i, att := range p.Attachments {
		fmt.Printf("[LLM]   Attachment %d: %s (type: %s, dataSize: %d)\n", i, att.Name, att.Type, len(att.Data))
	}
	fmt.Printf("[LLM] === END MULTIMODAL DEBUG ===\n")

	tenantID := ""
	if p.ProjectContext.Metadata != nil {
		tenantID = strings.TrimSpace(p.ProjectContext.Metadata["tenant_id"])
	}

	// Try cache first for faster responses
	endpointStartTime := time.Now()
	var resolved *ResolvedEndpoint
	if tenantID != "" {
		resolved = s.getCachedEndpoint(tenantID)
		if resolved != nil {
			fmt.Printf("[LLM] Generate: endpoint cache hit\n")
		}
	}
	if resolved == nil {
		var err error
		resolved, err = resolveEndpointFromDB(ctx, tenantID)
		if err != nil {
			return nil, &errs.Error{Code: errs.Internal, Message: fmt.Sprintf("resolve llm endpoint failed: %v", err)}
		}
		// Cache for future requests
		if tenantID != "" && resolved != nil {
			s.setCachedEndpoint(tenantID, resolved)
		}
		fmt.Printf("[LLM] Generate: endpoint DB lookup took %v\n", time.Since(endpointStartTime))
	}
	cfg := toConfig(resolved)
	if strings.TrimSpace(cfg.APIKey) == "" {
		if s.defaultErr != nil || s.defaultModel == nil {
			return nil, &errs.Error{Code: errs.Unavailable, Message: "llm not configured"}
		}
		cfg = defaultConfig()
	}

	// Build system prompt from project context (cached)
	promptStartTime := time.Now()
	systemPrompt := s.buildSystemPromptCached(p.ProjectContext)
	fmt.Printf("[LLM] Generate: system prompt built in %v\n", time.Since(promptStartTime))

	// Execute pre-generate extension hooks (skip if no extensions for speed)
	preprocessed := p.Prompt
	if p.ProjectContext.Extensions != nil && len(p.ProjectContext.Extensions) > 0 {
		preprocessed = s.applyExtensionHooks(ctx, "pre-generate", preprocessed, p.ProjectContext)
	}

	// Build messages - handle multimodal content if attachments exist
	var messages []*schema.Message

	// System message
	messages = append(messages, &schema.Message{
		Role:    schema.System,
		Content: systemPrompt,
	})

	// User message with potential multimodal content
	if len(p.Attachments) > 0 && hasImageExtension {
		fmt.Printf("[LLM] Processing %d file attachments with multimodal content\n", len(p.Attachments))

		// Check if there are any image attachments
		hasImages := false
		for _, att := range p.Attachments {
			if strings.HasPrefix(att.Type, "image/") && att.Data != "" {
				hasImages = true
				break
			}
		}

		if hasImages {
			// Build multimodal message with text + images
			var parts []schema.MessageInputPart

			// Add text part
			parts = append(parts, schema.MessageInputPart{
				Type: schema.ChatMessagePartTypeText,
				Text: preprocessed,
			})

			// Add image parts
			for _, att := range p.Attachments {
				if strings.HasPrefix(att.Type, "image/") && att.Data != "" {
					fmt.Printf("[LLM] Adding image: %s (%s, %d bytes)\n", att.Name, att.Type, att.Size)
					parts = append(parts, schema.MessageInputPart{
						Type: schema.ChatMessagePartTypeImageURL,
						Image: &schema.MessageInputImage{
							MessagePartCommon: schema.MessagePartCommon{
								Base64Data: &att.Data,
								MIMEType:   att.Type,
							},
							Detail: schema.ImageURLDetailAuto,
						},
					})
				} else if att.Type != "" {
					// Non-image file - add as text reference
					fmt.Printf("[LLM] Skipping non-image file: %s (%s)\n", att.Name, att.Type)
					parts[0].Text += fmt.Sprintf("\n\n[File Attachment: %s (%s, %d bytes)]", att.Name, att.Type, att.Size)
				}
			}

			messages = append(messages, &schema.Message{
				Role:                   schema.User,
				UserInputMultiContent: parts,
			})
			fmt.Printf("[LLM] Built multimodal message with %d parts\n", len(parts))
		} else {
			// No images, just add file references as text
			var fileContext strings.Builder
			for _, att := range p.Attachments {
				fileContext.WriteString(fmt.Sprintf("\n\n[File Attachment: %s (%s, %d bytes)]", att.Name, att.Type, att.Size))
			}
			messages = append(messages, &schema.Message{
				Role:    schema.User,
				Content: preprocessed + fileContext.String(),
			})
		}
	} else {
		// No attachments or image extension not enabled - use simple text message
		if len(p.Attachments) > 0 {
			fmt.Printf("[LLM] Image extension not enabled, treating files as text references\n")
			var fileContext strings.Builder
			for _, att := range p.Attachments {
				fileContext.WriteString(fmt.Sprintf("\n\n[File Attachment: %s (%s, %d bytes)]\nNote: The Image extension is not enabled. Please enable it to analyze image content.", att.Name, att.Type, att.Size))
			}
			preprocessed = preprocessed + fileContext.String()
		}

		messages = append(messages, &schema.Message{
			Role:    schema.User,
			Content: preprocessed,
		})
	}

	// Call LLM
	llmStartTime := time.Now()
	resp, err := s.generateWithConfigCached(ctx, cfg, messages)
	if err != nil {
		fmt.Printf("[LLM] Generate: LLM call failed after %v: %v\n", time.Since(llmStartTime), err)
		return nil, &errs.Error{Code: errs.Internal, Message: fmt.Sprintf("generate failed: %v", err)}
	}
	fmt.Printf("[LLM] Generate: LLM call completed in %v\n", time.Since(llmStartTime))

	content := strings.TrimSpace(resp.Content)
	if p.ProjectContext.Extensions != nil && len(p.ProjectContext.Extensions) > 0 {
		content = s.applyExtensionHooks(ctx, "post-generate", content, p.ProjectContext)
	}

	// Process tool calls if extension-creator is enabled
	if p.ProjectContext.Extensions != nil {
		for _, extID := range p.ProjectContext.Extensions {
			if extID == "extension-creator" {
				var messages []string
				content, messages, _ = s.processToolCalls(ctx, content, p.ProjectContext)
				if len(messages) > 0 {
					fmt.Printf("[LLM] Tool call messages: %v\n", messages)
				}
				break
			}
		}
	}

	// Enhanced weather integration - fetch real data from wttr.in API
	if p.ProjectContext.Extensions != nil {
		for _, extID := range p.ProjectContext.Extensions {
			if extID == "weather-indonesia" {
				content = s.enhanceWeatherResponse(ctx, content, p.Prompt)
				break
			}
		}
	}

	totalTime := time.Since(startTime)
	fmt.Printf("[LLM] Generate: total request took %v (validation=%v, endpoint=%v, prompt=%v, llm=%v)\n",
		totalTime, validationTime, time.Since(endpointStartTime), time.Since(promptStartTime), time.Since(llmStartTime))

	return &GenerateResponse{Content: content}, nil
}

// Status reports whether the default model is configured.
//
//encore:api public method=GET path=/llm/status
func (s *Service) Status(ctx context.Context) (*StatusResponse, error) {
	errMsg := ""
	if s.defaultErr != nil {
		errMsg = s.defaultErr.Error()
	}
	return &StatusResponse{
		Ready: s.defaultModel != nil && s.defaultErr == nil,
		Error: errMsg,
	}, nil
}

// Health returns a basic health status.
//
//encore:api public method=GET path=/llm/health
func (s *Service) Health(ctx context.Context) (*HealthResponse, error) {
	return &HealthResponse{Status: "ok"}, nil
}

// Completion handles POST /api/llm/completion - One-shot LLM completion.
//
//encore:api public method=POST path=/api/llm/completion
func (s *Service) Completion(ctx context.Context, p *CompletionParams) (*CompletionResult, error) {
	if p == nil || strings.TrimSpace(p.Prompt) == "" {
		return nil, badRequest("prompt is required")
	}

	resolved, err := ResolveEndpointForTenant(ctx, strings.TrimSpace(p.TenantID))
	if err != nil {
		return &CompletionResult{Success: false, Error: fmt.Sprintf("resolve llm endpoint failed: %v", err)}, nil
	}
	cfg := toConfig(resolved)
	if strings.TrimSpace(cfg.APIKey) == "" {
		if s.defaultErr != nil || s.defaultModel == nil {
			return &CompletionResult{Success: false, Error: "LLM service not available"}, nil
		}
		cfg = defaultConfig()
	}

	systemPrompt := "You are a helpful AI assistant."
	if p.Context != "" {
		systemPrompt = p.Context
	}

	resp, err := generateWithConfig(ctx, cfg, []*schema.Message{
		{Role: schema.System, Content: systemPrompt},
		{Role: schema.User, Content: p.Prompt},
	})
	if err != nil {
		return &CompletionResult{Success: false, Error: fmt.Sprintf("Generation failed: %v", err)}, nil
	}

	return &CompletionResult{Success: true, Response: strings.TrimSpace(resp.Content)}, nil
}

type CompletionParams struct {
	Prompt   string `json:"prompt"`
	Context  string `json:"context,omitempty"`
	TenantID string `json:"tenant_id,omitempty"`
}

type CompletionResult struct {
	Success  bool   `json:"success"`
	Response string `json:"response,omitempty"`
	Error    string `json:"error,omitempty"`
}

type FileAttachment struct {
	Name string `json:"name"`
	Type string `json:"type"`
	Size int64  `json:"size"`
	Data string `json:"data"` // Base64 encoded file data
}

type GenerateParams struct {
	Prompt         string            `json:"prompt"`
	ProjectContext *ProjectContext   `json:"project_context"`
	Attachments    []FileAttachment  `json:"attachments,omitempty"`
}

type ProjectContext struct {
	ProjectID    string            `json:"project_id"`
	ProjectName  string            `json:"project_name"`
	Instructions string            `json:"instructions"`
	Tone         string            `json:"tone"`
	Language     string            `json:"language"`
	Extensions   []string          `json:"extensions"`
	Metadata     map[string]string `json:"metadata"`
	ContextRole  string            `json:"context_role,omitempty"`
}

type GenerateResponse struct {
	Content string `json:"content"`
}

type GenerateStreamResponse struct {
	Content string `json:"content"`
}

type StatusResponse struct {
	Ready bool   `json:"ready"`
	Error string `json:"error"`
}

type HealthResponse struct {
	Status string `json:"status"`
}

// ToolDefinition represents a tool/function that the LLM can call
type ToolDefinition struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Parameters  map[string]ParameterDef `json:"parameters"`
}

// ParameterDef represents a tool parameter definition
type ParameterDef struct {
	Type        string `json:"type"`
	Description string `json:"description"`
	Required    bool   `json:"required"`
}

// ToolCall represents a tool call from the LLM
type ToolCall struct {
	ID       string                 `json:"id"`
	Name     string                 `json:"name"`
	Arguments map[string]interface{} `json:"arguments"`
}

// GetAvailableTools returns the tools available for the LLM to call
func (s *Service) GetAvailableTools() []ToolDefinition {
	return []ToolDefinition{
		{
			Name:        "createExtension",
			Description: "Create a new custom extension for this project. Use this when a user asks for new functionality that would benefit from a dedicated extension.",
			Parameters: map[string]ParameterDef{
				"id": {
					Type:        "string",
					Description: "Unique identifier for the extension (kebab-case, e.g., 'weather-indonesia')",
					Required:    true,
				},
				"name": {
					Type:        "string",
					Description: "Display name for the extension (e.g., 'Indonesia Weather')",
					Required:    true,
				},
				"description": {
					Type:        "string",
					Description: "What the extension does",
					Required:    true,
				},
				"category": {
					Type:        "string",
					Description: "Extension category: tools, web, utilities, documents, visualization, chat, context, database",
					Required:    false,
				},
				"code": {
					Type:        "string",
					Description: "JavaScript code for the extension (follows the template with context() function and exported object)",
					Required:    true,
				},
			},
		},
	}
}

// processToolCalls processes tool calls from LLM response
func (s *Service) processToolCalls(ctx context.Context, content string, projectCtx *ProjectContext) (string, []string, error) {
	// Check for CREATE_EXTENSION marker in the response
	// Expected format: ```json\n{"createExtension": {...}}\n```

	if !strings.Contains(content, "createExtension") && !strings.Contains(content, "CREATE_EXTENSION") {
		return content, nil, nil
	}

	fmt.Printf("[LLM] Tool call detected in response, processing...\n")

	// Extract JSON block with createExtension
	var jsonStart, jsonEnd int
	if idx := strings.Index(content, "```json"); idx >= 0 {
		jsonStart = idx + 7 // len("```json")
		if idx = strings.Index(content[jsonStart:], "```"); idx >= 0 {
			jsonEnd = jsonStart + idx
		}
	} else if idx := strings.Index(content, "```"); idx >= 0 {
		jsonStart = idx + 3 // len("```")
		if idx = strings.Index(content[jsonStart:], "```"); idx >= 0 {
			jsonEnd = jsonStart + idx
		}
	}

	if jsonEnd > jsonStart {
		jsonStr := strings.TrimSpace(content[jsonStart:jsonEnd])
		fmt.Printf("[LLM] Extracted JSON: %s\n", jsonStr)

		// Parse the tool call
		var toolCallData map[string]interface{}
		if err := json.Unmarshal([]byte(jsonStr), &toolCallData); err != nil {
			fmt.Printf("[LLM] Failed to parse tool call JSON: %v\n", err)
			return content, nil, nil
		}

		// Check for createExtension
		if extData, ok := toolCallData["createExtension"].(map[string]interface{}); ok {
			result, messages, err := s.executeCreateExtension(ctx, extData, projectCtx)
			if err != nil {
				messages = append(messages, fmt.Sprintf("Failed to create extension: %v", err))
				return content, messages, nil
			}

			// Replace the tool call with the result
			// Remove the JSON block and add success message
			responseBefore := ""
			if jsonStart >= 7 { // Make sure we don't go negative
				responseBefore = content[:jsonStart-7] // Remove ```json or ```
			}
			responseAfter := ""
			if jsonEnd+3 <= len(content) {
				responseAfter = content[jsonEnd+3:] // Remove closing ```
			}

			newContent := responseBefore + result + responseAfter
			return newContent, messages, nil
		}
	}

	return content, nil, nil
}

// executeCreateExtension executes the createExtension tool call
func (s *Service) executeCreateExtension(ctx context.Context, extData map[string]interface{}, projectCtx *ProjectContext) (string, []string, error) {
	fmt.Printf("[LLM] executeCreateExtension called with data: %+v\n", extData)

	// Extract parameters
	extID, _ := extData["id"].(string)
	name, _ := extData["name"].(string)
	description, _ := extData["description"].(string)
	category, _ := extData["category"].(string)
	if category == "" {
		category = "utilities"
	}
	code, _ := extData["code"].(string)

	// Validate required fields
	if extID == "" || name == "" || description == "" || code == "" {
		return "", nil, fmt.Errorf("missing required fields: id, name, description, and code are required")
	}

	// Get project ID
	projectID := projectCtx.ProjectID
	if projectID == "" {
		return "", nil, fmt.Errorf("project ID is required")
	}

	// For now, we'll create the extension directly in the database
	// This is a workaround since Encore doesn't allow direct service instantiation
	fmt.Printf("[LLM] Creating extension via direct DB call: %s\n", extID)

	// Get the database
	db, err := iam.GetDB()
	if err != nil {
		return "", nil, fmt.Errorf("failed to get database: %w", err)
	}

	// Prepare capabilities JSON
	capabilitiesJSON, _ := json.Marshal([]string{})

	// Insert directly to database
	now := time.Now().UTC().Format(time.RFC3339)
	_, err = db.ExecContext(ctx, `
		INSERT INTO project_extensions
		(id, project_id, name, description, author, version, category, enabled, is_default, capabilities, code, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, extID, projectID, name, description, "Custom", "1.0.0", category,
		1, // enabled by default
		0, // is_default = false (custom extension)
		string(capabilitiesJSON),
		code,
		now, now)

	if err != nil {
		return "", nil, fmt.Errorf("failed to insert extension: %w", err)
	}

	// Create the JavaScript file on disk so the extension can be executed
	extDir := filepath.Join("./extensions", extID)
	extFilePath := filepath.Join(extDir, "index.js")
	extJsonPath := filepath.Join(extDir, "extension.json")

	// Create directory if it doesn't exist
	if err := os.MkdirAll(extDir, 0755); err != nil {
		fmt.Printf("[LLM] Warning: failed to create extension directory: %v\n", err)
		// Continue anyway - extension is in DB, just not executable
	} else {
		// Write the JavaScript code to file
		if err := os.WriteFile(extFilePath, []byte(code), 0644); err != nil {
			fmt.Printf("[LLM] Warning: failed to write extension file: %v\n", err)
			// Continue anyway - extension is in DB, just not executable
		} else {
			fmt.Printf("[LLM] Extension file created: %s\n", extFilePath)

			// Create extension.json metadata file
			extJson := map[string]interface{}{
				"id":          extID,
				"version":     "1.0.0",
				"name":        name,
				"description": description,
				"hooks":       []string{"pre-generate", "post-generate"},
				"enabled":     true,
			}
			extJsonBytes, _ := json.MarshalIndent(extJson, "", "  ")
			if err := os.WriteFile(extJsonPath, extJsonBytes, 0644); err != nil {
				fmt.Printf("[LLM] Warning: failed to write extension.json: %v\n", err)
			} else {
				fmt.Printf("[LLM] Extension metadata created: %s\n", extJsonPath)
			}

			// Try to load the extension into the executor so it's immediately available
			if s.executor != nil {
				ext := &extensions.Extension{
					ID:   extID,
					Hooks: []string{"pre-generate", "post-generate"},
				}
				if loadErr := s.executor.LoadExtension(ctx, ext); loadErr != nil {
					fmt.Printf("[LLM] Warning: could not load extension into executor: %v\n", loadErr)
				} else {
					fmt.Printf("[LLM] Extension loaded into executor successfully\n")
				}
			}
		}
	}

	var messages []string
	messages = append(messages, fmt.Sprintf("✅ Extension '%s' created successfully!", name))
	messages = append(messages, fmt.Sprintf("The extension is now available in the Extensions page."))
	messages = append(messages, fmt.Sprintf("You can now enable it and use it in this conversation."))

	return fmt.Sprintf("\n\n✅ **Extension Created Successfully!**\n\nI've created the **%s** extension for you. It's now available in the Extensions page and ready to use!\n\n", name), messages, nil
}

func badRequest(message string) error {
	return &errs.Error{Code: errs.InvalidArgument, Message: message}
}

// isSimpleGreeting checks if the prompt is a simple greeting that can be fast-tracked
func isSimpleGreeting(prompt string) bool {
	// Trim and clean the prompt
	prompt = strings.TrimSpace(strings.ToLower(prompt))

	// Empty or just symbols/emojis - treat as greeting
	if len(prompt) <= 3 {
		return true
	}

	// Common greetings in English and Indonesian
	greetings := []string{
		// English
		"hi", "hello", "hey", "hiya", "howdy",
		"good morning", "good afternoon", "good evening", "good night",
		"what's up", "whats up", "sup", "yo",
		// Indonesian
		"halo", "hai", "haii", "helo", "helo",
		"selamat pagi", "selamat siang", "selamat sore", "selamat malam",
		"apa kabar", "kabar", "salam",
		// Emojis and symbols
		"👋", "🙌", "👋🏻", "👋🏼", "👋🏽", "👋🏾", "👋🏿",
		":)", ": )", ":-)", "=)", "= )",
		// Short greetings
		"?", "!", ".", "...",
	}

	for _, greeting := range greetings {
		// Exact match
		if prompt == greeting {
			return true
		}
		// Starts with greeting
		if strings.HasPrefix(prompt, greeting+" ") {
			return true
		}
		// Contains greeting (for emojis)
		if strings.Contains(prompt, greeting) && len(prompt) < 10 {
			return true
		}
	}

	// Very short prompts (1-3 chars) are likely greetings
	if len(prompt) <= 3 {
		return true
	}

	return false
}

// getGreetingResponse returns a quick response for simple greetings
func getGreetingResponse(prompt string) string {
	prompt = strings.ToLower(strings.TrimSpace(prompt))

	// Handle different greeting types
	if strings.Contains(prompt, "pagi") || strings.Contains(prompt, "morning") {
		return "Selamat pagi! Semoga harimu menyenangkan. Ada yang bisa saya bantu hari ini? / Good morning! Hope you have a great day. How can I help you?"
	}
	if strings.Contains(prompt, "siang") || strings.Contains(prompt, "afternoon") {
		return "Selamat siang! Ada yang bisa saya bantu? / Good afternoon! How can I help you today?"
	}
	if strings.Contains(prompt, "sore") || strings.Contains(prompt, "evening") {
		return "Selamat sore! Ada yang bisa saya bantu? / Good evening! How can I help you?"
	}
	if strings.Contains(prompt, "malam") || strings.Contains(prompt, "night") {
		return "Selamat malam! Ada yang bisa saya bantu? / Good night! How can I help you?"
	}
	if strings.Contains(prompt, "kabar") || strings.Contains(prompt, "apa kabar") {
		return "Kabar baik! Terima kasih sudah bertanya. Ada yang bisa saya bantu? / I'm doing well, thanks! How can I help you today?"
	}

	// Default friendly response
	return "Halo! 👋 Ada yang bisa saya bantu hari ini? / Hello! 👋 How can I help you today?"
}

func randomHex(n int) string {
	if n <= 0 {
		return ""
	}
	b := make([]byte, n)
	_, _ = rand.Read(b)
	const hex = "0123456789abcdef"
	out := make([]byte, n*2)
	for i, v := range b {
		out[i*2] = hex[v>>4]
		out[i*2+1] = hex[v&0x0f]
	}
	return string(out)
}

// buildSystemPrompt constructs a system prompt from project context.
// Optimized to be concise while maintaining functionality.
func buildSystemPrompt(ctx *ProjectContext) string {
	var sb strings.Builder

	// CRITICAL: Instructions from Workspace > Context are MOST important
	// They define how the AI should respond
	if ctx.Instructions != "" && len(strings.TrimSpace(ctx.Instructions)) > 10 {
		// Use instructions as the primary directive
		sb.WriteString(strings.TrimSpace(ctx.Instructions))
	} else {
		// Fallback to generic assistant
		sb.WriteString("You are a helpful AI assistant.")
	}

	// IMPORTANT: Add Extension Creator context REGARDLESS of custom instructions
	// This should always be added when extension-creator is enabled
	if ctx.Extensions != nil {
		fmt.Printf("[buildSystemPrompt] Checking extensions: %v\n", ctx.Extensions)

		// First, add extension creator
		for _, extID := range ctx.Extensions {
			if extID == "extension-creator" {
				fmt.Printf("[buildSystemPrompt] Extension Creator FOUND! Adding context to system prompt.\n")
				sb.WriteString("\n\n## Extension Creator\n\n")
				sb.WriteString("You can create custom extensions for this project. When users ask for new functionality, ")
				sb.WriteString("generate the extension code and create it by outputting a JSON block with this format:\n\n")
				sb.WriteString("```json\n")
				sb.WriteString("{\n")
				sb.WriteString("  \"createExtension\": {\n")
				sb.WriteString("    \"id\": \"extension-id\",\n")
				sb.WriteString("    \"name\": \"Extension Name\",\n")
				sb.WriteString("    \"description\": \"What it does\",\n")
				sb.WriteString("    \"category\": \"tools\",\n")
				sb.WriteString("    \"code\": \"// complete JavaScript code here\"\n")
				sb.WriteString("  }\n")
				sb.WriteString("}\n")
				sb.WriteString("```\n\n")
				sb.WriteString("**Important:** The JSON block MUST contain the `createExtension` key. When the system processes this, ")
				sb.WriteString("the extension will be automatically created and available for use.\n")
				break
			}
		}

		// Second, add available functions from other custom extensions (weather, etc)
		sb.WriteString("\n\n## Available Functions\n\n")
		sb.WriteString("You can call these functions from extensions when relevant:\n\n")

		for _, extID := range ctx.Extensions {
			// Skip extension-creator and built-in extensions
			if extID == "extension-creator" || extID == "chat-logger" || extID == "response-enhancer" {
				continue
			}

			// Try to read extension file directly
			extFilePath := filepath.Join("../extensions", extID, "index.js")
			if content, err := os.ReadFile(extFilePath); err == nil {
				code := string(content)

				// Extract function names using simple parsing
				// Look for: function name(...), async function name(...)
				functions := []string{}

				// Simple manual parsing
				lines := strings.Split(code, "\n")
				for _, line := range lines {
					line = strings.TrimSpace(line)
					if strings.HasPrefix(line, "async function ") {
						parts := strings.Fields(line)
						if len(parts) >= 3 {
							fnName := strings.TrimSuffix(parts[2], "(")
							functions = append(functions, fnName)
						}
					} else if strings.HasPrefix(line, "function ") {
						parts := strings.Fields(line)
						if len(parts) >= 2 {
							fnName := strings.TrimSuffix(parts[1], "(")
							functions = append(functions, fnName)
						}
					}
				}

				if len(functions) > 0 {
					// Get extension name from filename or ID
					extName := strings.Title(strings.ReplaceAll(extID, "-", " "))
					fmt.Printf("[buildSystemPrompt] Found functions in %s: %v\n", extID, functions)

					sb.WriteString(fmt.Sprintf("### %s Extension\n", extName))
					for _, fn := range functions {
						sb.WriteString(fmt.Sprintf("- **%s()**: Call this function to use the extension\n", fn))
					}
					sb.WriteString("\n")
				}
			}
		}
	}

	// Add project context if meaningful
	if ctx.ProjectName != "" && ctx.ProjectName != "Project" {
		sb.WriteString(fmt.Sprintf("\n\nProject: %s", ctx.ProjectName))
	}

	return sb.String()
}

// buildSystemPromptCached constructs and caches system prompts for better performance.
// Creates a cache key from the unique combination of context parameters.
func (s *Service) buildSystemPromptCached(ctx *ProjectContext) string {
	// Create cache key from relevant context fields (including extensions)
	extensionsKey := ""
	if ctx.Extensions != nil {
		extensionsKey = strings.Join(ctx.Extensions, ",")
	}
	key := fmt.Sprintf("%s|%s|%s|%s|%s|%s",
		ctx.ProjectID,
		ctx.ProjectName,
		ctx.Instructions,
		ctx.Tone,
		ctx.Language,
		extensionsKey,
	)

	// Try cache first
	s.systemPromptCacheMutex.RLock()
	if cached, ok := s.systemPromptCache[key]; ok {
		s.systemPromptCacheMutex.RUnlock()
		return cached
	}
	s.systemPromptCacheMutex.RUnlock()

	// Build prompt if not cached
	prompt := buildSystemPrompt(ctx)

	// Store in cache
	s.systemPromptCacheMutex.Lock()
	s.systemPromptCache[key] = prompt
	s.systemPromptCacheMutex.Unlock()

	return prompt
}

// applyExtensionHooks calls extension handlers via the extension runtime.
func (s *Service) applyExtensionHooks(ctx context.Context, hookName string, input string, projectCtx *ProjectContext) string {
	if s.executor == nil || len(projectCtx.Extensions) == 0 {
		return input
	}

	result := input
	for _, extID := range projectCtx.Extensions {
		// Skip extension-creator - it's handled by processToolCalls, not as a JS hook
		if extID == "extension-creator" {
			continue
		}

		// Try to load the extension if not already loaded
		ext := &extensions.Extension{
			ID:   extID,
			Hooks: []string{"pre-generate", "post-generate"},
		}
		_ = s.executor.LoadExtension(ctx, ext) // Ignore errors, extension might already be loaded
		req := &extensions.ExecuteRequest{
			ExtensionID: extID,
			Hook:        extensions.HookType(hookName),
			Input:       result,
			ProjectID:   projectCtx.ProjectID,
			Context: map[string]any{
				"project_name": projectCtx.ProjectName,
				"metadata":     projectCtx.Metadata,
			},
		}

		resp, err := s.executor.Execute(ctx, req)
		if err != nil {
			fmt.Printf("extension error (hook=%s, ext=%s): %v\n", hookName, extID, err)
			continue
		}

		result = resp.Output
	}

	return result
}

// enhanceWeatherResponse fetches real weather data from wttr.in API and appends it to the response
func (s *Service) enhanceWeatherResponse(ctx context.Context, response string, userPrompt string) string {
	prompt := strings.ToLower(userPrompt)

	// Check if asking about weather
	weatherKeywords := []string{"cuaca", "weather", "prakiraan", "suhu", "hujan", "panas", "dingin"}
	hasWeatherKeyword := false
	for _, keyword := range weatherKeywords {
		if strings.Contains(prompt, keyword) {
			hasWeatherKeyword = true
			break
		}
	}

	if !hasWeatherKeyword {
		return response
	}

	// Extract city name
	allowedCities := []string{"jakarta", "bandung", "surabaya", "medan", "makassar"}
	var city string
	for _, c := range allowedCities {
		if strings.Contains(prompt, c) {
			city = c
			break
		}
	}

	if city == "" {
		return response
	}

	fmt.Printf("[enhanceWeatherResponse] Fetching weather for: %s\n", city)

	// Fetch from wttr.in API
	apiURL := fmt.Sprintf("https://wttr.in/%s?format=j1", city)

	// Use http.Get with timeout
	client := &http.Client{
		Timeout: 5 * time.Second,
	}

	resp, err := client.Get(apiURL)
	if err != nil {
		fmt.Printf("[enhanceWeatherResponse] API call failed: %v\n", err)
		return response
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("[enhanceWeatherResponse] Failed to read response: %v\n", err)
		return response
	}

	// Parse JSON response
	var apiResponse struct {
		CurrentCondition []struct {
			TempC          string `json:"temp_C"`
			FeelsLikeC     string `json:"FeelsLikeC"`
			WeatherDesc    []struct {
				Value string `json:"value"`
			} `json:"weatherDesc"`
			Humidity       string `json:"humidity"`
			WindspeedKmph  string `json:"windspeedKmph"`
			UVIndex        int    `json:"uvIndex"`
		} `json:"current_condition"`
		NearestArea []struct {
			AreaName []struct {
				Value string `json:"value"`
			} `json:"areaName"`
		} `json:"nearest_area"`
	}

	if err := json.Unmarshal(body, &apiResponse); err != nil {
		fmt.Printf("[enhanceWeatherResponse] Failed to parse JSON: %v\n", err)
		return response
	}

	if len(apiResponse.CurrentCondition) == 0 || len(apiResponse.NearestArea) == 0 {
		fmt.Printf("[enhanceWeatherResponse] No data in API response\n")
		return response
	}

	current := apiResponse.CurrentCondition[0]
	areaName := apiResponse.NearestArea[0].AreaName[0].Value

	// Format weather data
	weatherData := fmt.Sprintf(`

---

☀️ **Cuaca di %s**
🌡️ Suhu: %s°C (terasa %s°C)
☁️ Kondisi: %s
💧 Kelembapan: %s%%
💨 Angin: %s km/h
🌅 UV Index: %d
---

`, strings.Title(areaName), current.TempC, current.FeelsLikeC, current.WeatherDesc[0].Value, current.Humidity, current.WindspeedKmph, current.UVIndex)

	fmt.Printf("[enhanceWeatherResponse] Weather data appended successfully\n")

	return response + weatherData
}
