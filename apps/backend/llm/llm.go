package llm

import (
	"context"
	"crypto/rand"
	"database/sql"
	"errors"
	"fmt"
	"math"
	"math/big"
	"os"
	"strings"
	"time"

	"encore.app/backend/iam"
	"encore.app/backend/llm/extensions"
	"encore.dev/beta/auth"
	"encore.dev/beta/errs"

	"github.com/cloudwego/eino-ext/components/model/openai"
	"github.com/cloudwego/eino/schema"
)

//encore:service
type Service struct {
	defaultModel *openai.ChatModel
	defaultErr   error
	executor     extensions.Executor
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
	return &Service{defaultModel: model, defaultErr: err, executor: executor}, nil
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
	chatModel, err := openai.NewChatModel(ctx, &openai.ChatModelConfig{
		APIKey:  cfg.APIKey,
		Model:   cfg.Model,
		BaseURL: cfg.BaseURL,
	})
	if err != nil {
		return nil, fmt.Errorf("init llm: %w", err)
	}
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

// Generate runs a single prompt and returns the model response.
//
//encore:api public method=POST path=/llm/generate
func (s *Service) Generate(ctx context.Context, p *GenerateParams) (*GenerateResponse, error) {
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

	resolved, err := ResolveEndpointForTenant(ctx, tenantID)
	if err != nil {
		return nil, &errs.Error{Code: errs.Internal, Message: fmt.Sprintf("resolve llm endpoint failed: %v", err)}
	}
	cfg := toConfig(resolved)
	if strings.TrimSpace(cfg.APIKey) == "" {
		if s.defaultErr != nil || s.defaultModel == nil {
			return nil, &errs.Error{Code: errs.Unavailable, Message: "llm not configured"}
		}
		cfg = defaultConfig()
	}

	// Build system prompt from project context
	systemPrompt := buildSystemPrompt(p.ProjectContext)

	// Execute pre-generate extension hooks
	preprocessed := p.Prompt
	if p.ProjectContext.Extensions != nil {
		preprocessed = s.applyExtensionHooks(ctx, "pre-generate", preprocessed, p.ProjectContext)
	}

	resp, err := generateWithConfig(ctx, cfg, []*schema.Message{
		{Role: schema.System, Content: systemPrompt},
		{Role: schema.User, Content: preprocessed},
	})
	if err != nil {
		return nil, &errs.Error{Code: errs.Internal, Message: fmt.Sprintf("generate failed: %v", err)}
	}

	content := strings.TrimSpace(resp.Content)
	if p.ProjectContext.Extensions != nil {
		content = s.applyExtensionHooks(ctx, "post-generate", content, p.ProjectContext)
	}

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

type GenerateParams struct {
	Prompt         string          `json:"prompt"`
	ProjectContext *ProjectContext `json:"project_context"`
}

type ProjectContext struct {
	ProjectID    string            `json:"project_id"`
	ProjectName  string            `json:"project_name"`
	Instructions string            `json:"instructions"`
	Tone         string            `json:"tone"`
	Language     string            `json:"language"`
	Extensions   []string          `json:"extensions"`
	Metadata     map[string]string `json:"metadata"`
}

type GenerateResponse struct {
	Content string `json:"content"`
}

type StatusResponse struct {
	Ready bool   `json:"ready"`
	Error string `json:"error"`
}

type HealthResponse struct {
	Status string `json:"status"`
}

func badRequest(message string) error {
	return &errs.Error{Code: errs.InvalidArgument, Message: message}
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
func buildSystemPrompt(ctx *ProjectContext) string {
	var sb strings.Builder
	sb.WriteString("You are a helpful AI assistant.\n\n")

	if ctx.ProjectName != "" {
		sb.WriteString(fmt.Sprintf("Project: %s\n", ctx.ProjectName))
	}

	if ctx.Instructions != "" {
		sb.WriteString(fmt.Sprintf("\nInstructions:\n%s\n", ctx.Instructions))
	}

	if ctx.Tone != "" {
		sb.WriteString(fmt.Sprintf("\nTone: Respond in a %s manner.\n", ctx.Tone))
	}

	if ctx.Language != "" && ctx.Language != "english" && ctx.Language != "en" {
		sb.WriteString(fmt.Sprintf("\nRespond in %s.\n", ctx.Language))
	}

	return sb.String()
}

// applyExtensionHooks calls extension handlers via the extension runtime.
func (s *Service) applyExtensionHooks(ctx context.Context, hookName string, input string, projectCtx *ProjectContext) string {
	if s.executor == nil || len(projectCtx.Extensions) == 0 {
		return input
	}

	result := input
	for _, extID := range projectCtx.Extensions {
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
