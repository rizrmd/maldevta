package extensions

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

// HTTPExecutor communicates with an external extension runtime via HTTP.
// Note: Use GojaExecutor for in-process execution with better performance.
type HTTPExecutor struct {
	client  *http.Client
	baseURL string
}

// NewHTTPExecutor creates a new extension executor.
// You can pass "" for baseURL to use the default from EXTENSION_SERVER_URL env var.
func NewHTTPExecutor(baseURL string) *HTTPExecutor {
	if baseURL == "" {
		baseURL = os.Getenv("EXTENSION_SERVER_URL")
		if baseURL == "" {
			baseURL = "http://localhost:3001"
		}
	}

	return &HTTPExecutor{
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
		baseURL: baseURL,
	}
}

// Execute sends a request to the extension runtime and waits for the response.
func (e *HTTPExecutor) Execute(ctx context.Context, req *ExecuteRequest) (*ExecuteResponse, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(
		ctx,
		"POST",
		fmt.Sprintf("%s/extension/execute", e.baseURL),
		bytes.NewReader(body),
	)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := e.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("extension runtime error: %s", string(respBody))
	}

	var execResp ExecuteResponse
	if err := json.Unmarshal(respBody, &execResp); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	if execResp.Error != "" {
		return nil, fmt.Errorf("extension error: %s", execResp.Error)
	}

	return &execResp, nil
}

// LoadExtension tells the extension runtime to load an extension.
func (e *HTTPExecutor) LoadExtension(ctx context.Context, ext *Extension) error {
	body, err := json.Marshal(ext)
	if err != nil {
		return fmt.Errorf("marshal extension: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(
		ctx,
		"POST",
		fmt.Sprintf("%s/extension/load", e.baseURL),
		bytes.NewReader(body),
	)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := e.client.Do(httpReq)
	if err != nil {
		return fmt.Errorf("load request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("load failed: %s", string(body))
	}

	return nil
}

// Health checks if the extension runtime is healthy.
func (e *HTTPExecutor) Health(ctx context.Context) (bool, error) {
	httpReq, err := http.NewRequestWithContext(
		ctx,
		"GET",
		fmt.Sprintf("%s/health", e.baseURL),
		nil,
	)
	if err != nil {
		return false, fmt.Errorf("create request: %w", err)
	}

	resp, err := e.client.Do(httpReq)
	if err != nil {
		return false, fmt.Errorf("health check failed: %w", err)
	}
	defer resp.Body.Close()

	return resp.StatusCode == http.StatusOK, nil
}
