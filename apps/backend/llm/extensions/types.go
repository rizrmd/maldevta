package extensions

import "context"

// HookType represents the stage in the LLM pipeline where an extension runs.
type HookType string

const (
	HookPreGenerate  HookType = "pre-generate"
	HookPostGenerate HookType = "post-generate"
	HookValidate     HookType = "validate"
)

// Extension represents a loadable extension that can hook into the LLM pipeline.
type Extension struct {
	ID       string   `json:"id"`
	Version  string   `json:"version"`
	Hooks    []string `json:"hooks"`
	Enabled  bool     `json:"enabled"`
	Config   map[string]any `json:"config"`
}

// ExecuteRequest is sent to the extension executor.
type ExecuteRequest struct {
	ExtensionID string            `json:"extension_id"`
	Hook        HookType          `json:"hook"`
	Input       string            `json:"input"`
	ProjectID   string            `json:"project_id"`
	Context     map[string]any    `json:"context"`
}

// ExecuteResponse is received from the extension executor.
type ExecuteResponse struct {
	Output string `json:"output"`
	Error  string `json:"error"`
}

// Executor manages communication with the extension runtime.
type Executor interface {
	Execute(ctx context.Context, req *ExecuteRequest) (*ExecuteResponse, error)
	LoadExtension(ctx context.Context, ext *Extension) error
	Health(ctx context.Context) (bool, error)
}
