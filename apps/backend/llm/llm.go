package llm

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"

	"encore.dev/beta/errs"

	"github.com/cloudwego/eino-ext/components/model/openai"
	"github.com/cloudwego/eino/schema"

	"encore.app/backend/llm/extensions"
)

//encore:service
type Service struct {
	model    *openai.ChatModel
	err      error
	executor extensions.Executor
}

func initService() (*Service, error) {
	ctx := context.Background()
	model, err := initModel(ctx)
	executor := extensions.NewGojaExecutor("")
	return &Service{model: model, err: err, executor: executor}, nil
}

func initModel(ctx context.Context) (*openai.ChatModel, error) {
	apiKey := strings.TrimSpace(os.Getenv("OPENAI_API_KEY"))
	if apiKey == "" {
		return nil, errors.New("OPENAI_API_KEY is not set")
	}

	model := strings.TrimSpace(os.Getenv("OPENAI_MODEL"))
	if model == "" {
		model = "gpt-4o-mini"
	}

	chatModel, err := openai.NewChatModel(ctx, &openai.ChatModelConfig{
		APIKey:     apiKey,
		Model:      model,
		BaseURL:    strings.TrimSpace(os.Getenv("OPENAI_BASE_URL")),
	})
	if err != nil {
		return nil, fmt.Errorf("init llm: %w", err)
	}

	return chatModel, nil
}

// Generate runs a single prompt and returns the model response.
//
//encore:api public method=POST path=/llm/generate
func (s *Service) Generate(ctx context.Context, p *GenerateParams) (*GenerateResponse, error) {
	if p == nil || strings.TrimSpace(p.Prompt) == "" {
		return nil, badRequest("prompt is required")
	}
	if s.err != nil || s.model == nil {
		return nil, errs.New(errs.Unavailable, "llm not configured")
	}
	if p.ProjectContext == nil {
		return nil, badRequest("project_context is required")
	}

	// Build system prompt from project context
	systemPrompt := buildSystemPrompt(p.ProjectContext)

	// Execute pre-generate extension hooks
	preprocessed := p.Prompt
	if p.ProjectContext.Extensions != nil {
		// Extensions can modify the prompt before generation
		preprocessed = s.applyExtensionHooks(ctx, "pre-generate", preprocessed, p.ProjectContext)
	}

	resp, err := s.model.Generate(ctx, []*schema.Message{
		{
			Role:    schema.System,
			Content: systemPrompt,
		},
		{
			Role:    schema.User,
			Content: preprocessed,
		},
	})
	if err != nil {
		return nil, errs.New(errs.Internal, fmt.Sprintf("generate failed: %v", err))
	}

	content := strings.TrimSpace(resp.Content)

	// Execute post-generate extension hooks
	if p.ProjectContext.Extensions != nil {
		content = s.applyExtensionHooks(ctx, "post-generate", content, p.ProjectContext)
	}

	return &GenerateResponse{Content: content}, nil
}

// Status reports whether the model is configured.
//
//encore:api public method=GET path=/llm/status
func (s *Service) Status(ctx context.Context) (*StatusResponse, error) {
	errMsg := ""
	if s.err != nil {
		errMsg = s.err.Error()
	}
	return &StatusResponse{
		Ready: s.model != nil && s.err == nil,
		Error: errMsg,
	}, nil
}

// Health returns a basic health status.
//
//encore:api public method=GET path=/llm/health
func (s *Service) Health(ctx context.Context) (*HealthResponse, error) {
	return &HealthResponse{Status: "ok"}, nil
}

type GenerateParams struct {
	Prompt         string          `json:"prompt"`
	ProjectContext *ProjectContext `json:"project_context"`
}

type ProjectContext struct {
	// Project identification
	ProjectID   string `json:"project_id"`
	ProjectName string `json:"project_name"`

	// System prompt customization
	Instructions string `json:"instructions"` // Custom system instructions
	Tone         string `json:"tone"`         // Expected tone (professional, casual, etc)
	Language     string `json:"language"`     // Output language

	// Extensions to apply
	Extensions []string `json:"extensions"`

	// Additional context
	Metadata map[string]any `json:"metadata"`
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
			// Log but don't fail on extension error
			fmt.Printf("extension error (hook=%s, ext=%s): %v\n", hookName, extID, err)
			continue
		}

		result = resp.Output
	}

	return result
}
