package extensions

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/dop251/goja"
)

// GojaExecutor runs JavaScript extensions in-process using Goja.
type GojaExecutor struct {
	mu         sync.RWMutex
	extensions map[string]*loadedExtension
	vmPool     *vmPool
	basePath   string
}

type loadedExtension struct {
	ext    *Extension
	script string
}

type vmPool struct {
	pool chan *goja.Runtime
	size int
}

func newVMPool(size int) *vmPool {
	pool := &vmPool{
		pool: make(chan *goja.Runtime, size),
		size: size,
	}
	
	// Pre-create VMs
	for i := 0; i < size; i++ {
		pool.pool <- goja.New()
	}
	
	return pool
}

func (p *vmPool) get() *goja.Runtime {
	select {
	case vm := <-p.pool:
		return vm
	default:
		return goja.New()
	}
}

func (p *vmPool) put(vm *goja.Runtime) {
	select {
	case p.pool <- vm:
	default:
		// Pool is full, let it be garbage collected
	}
}

// NewGojaExecutor creates a new in-process JavaScript executor.
// basePath is the directory where extension scripts are located.
func NewGojaExecutor(basePath string) *GojaExecutor {
	if basePath == "" {
		basePath = os.Getenv("EXTENSION_PATH")
		if basePath == "" {
			basePath = "./extensions"
		}
	}

	return &GojaExecutor{
		extensions: make(map[string]*loadedExtension),
		vmPool:     newVMPool(10), // Pool of 10 VMs
		basePath:   basePath,
	}
}

// Execute runs an extension hook with the given input.
func (e *GojaExecutor) Execute(ctx context.Context, req *ExecuteRequest) (*ExecuteResponse, error) {
	// Get extension
	e.mu.RLock()
	loaded, ok := e.extensions[req.ExtensionID]
	e.mu.RUnlock()
	
	if !ok {
		return nil, fmt.Errorf("extension not loaded: %s", req.ExtensionID)
	}

	// Check if extension supports this hook
	if !e.supportsHook(loaded.ext, string(req.Hook)) {
		return nil, fmt.Errorf("extension %s does not support hook %s", req.ExtensionID, req.Hook)
	}

	// Create execution context with timeout
	execCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	// Get VM from pool
	vm := e.vmPool.get()
	defer func() {
		// Reset VM before returning to pool
		vm = goja.New()
		e.vmPool.put(vm)
	}()

	// Execute with context cancellation
	resultChan := make(chan *ExecuteResponse, 1)
	errChan := make(chan error, 1)

	go func() {
		resp, err := e.executeInVM(vm, loaded, req)
		if err != nil {
			errChan <- err
			return
		}
		resultChan <- resp
	}()

	select {
	case <-execCtx.Done():
		return nil, fmt.Errorf("execution timeout exceeded")
	case err := <-errChan:
		return nil, err
	case resp := <-resultChan:
		return resp, nil
	}
}

func (e *GojaExecutor) executeInVM(vm *goja.Runtime, loaded *loadedExtension, req *ExecuteRequest) (*ExecuteResponse, error) {
	// Set up the execution environment
	obj := vm.NewObject()
	
	// Convert request to JavaScript object
	reqData := map[string]interface{}{
		"extensionId": req.ExtensionID,
		"hook":        string(req.Hook),
		"input":       req.Input,
		"projectId":   req.ProjectID,
		"context":     req.Context,
	}
	
	if err := obj.Set("request", reqData); err != nil {
		return nil, fmt.Errorf("set request: %w", err)
	}

	// Add console.log support
	console := vm.NewObject()
	console.Set("log", func(call goja.FunctionCall) goja.Value {
		args := make([]interface{}, len(call.Arguments))
		for i, arg := range call.Arguments {
			args[i] = arg.Export()
		}
		fmt.Printf("[extension:%s] ", req.ExtensionID)
		fmt.Println(args...)
		return goja.Undefined()
	})
	vm.Set("console", console)
	
	vm.Set("__extension", obj)

	// Run the extension script
	if _, err := vm.RunString(loaded.script); err != nil {
		return nil, fmt.Errorf("run script: %w", err)
	}

	// Call the hook function
	hookFuncName := e.getHookFunctionName(string(req.Hook))
	val := vm.Get(hookFuncName)
	if val == nil || goja.IsUndefined(val) {
		return nil, fmt.Errorf("hook function %s not found", hookFuncName)
	}

	fn, ok := goja.AssertFunction(val)
	if !ok {
		return nil, fmt.Errorf("%s is not a function", hookFuncName)
	}

	// Call the hook function with the request object
	result, err := fn(goja.Undefined(), vm.ToValue(reqData))
	if err != nil {
		return &ExecuteResponse{
			Output: "",
			Error:  fmt.Sprintf("execution error: %v", err),
		}, nil
	}

	// Extract the result
	output := ""
	if result != nil && !goja.IsUndefined(result) {
		exported := result.Export()
		switch v := exported.(type) {
		case string:
			output = v
		case map[string]interface{}:
			if o, ok := v["output"].(string); ok {
				output = o
			} else {
				// Marshal the entire object
				data, _ := json.Marshal(v)
				output = string(data)
			}
		default:
			output = fmt.Sprintf("%v", v)
		}
	}

	return &ExecuteResponse{
		Output: output,
		Error:  "",
	}, nil
}

func (e *GojaExecutor) getHookFunctionName(hook string) string {
	switch hook {
	case "pre-generate":
		return "preGenerate"
	case "post-generate":
		return "postGenerate"
	case "validate":
		return "validate"
	default:
		return hook
	}
}

func (e *GojaExecutor) supportsHook(ext *Extension, hook string) bool {
	for _, h := range ext.Hooks {
		if h == hook {
			return true
		}
	}
	return false
}

// LoadExtension loads a JavaScript extension from the filesystem.
func (e *GojaExecutor) LoadExtension(ctx context.Context, ext *Extension) error {
	// Build script path
	scriptPath := filepath.Join(e.basePath, ext.ID, "index.js")
	
	// Check if file exists
	if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
		return fmt.Errorf("extension script not found: %s", scriptPath)
	}

	// Read the script
	scriptBytes, err := os.ReadFile(scriptPath)
	if err != nil {
		return fmt.Errorf("read script: %w", err)
	}

	// Validate the script by compiling it
	vm := goja.New()
	if _, err := vm.RunString(string(scriptBytes)); err != nil {
		return fmt.Errorf("invalid script: %w", err)
	}

	// Store the loaded extension
	e.mu.Lock()
	e.extensions[ext.ID] = &loadedExtension{
		ext:    ext,
		script: string(scriptBytes),
	}
	e.mu.Unlock()

	return nil
}

// Health checks if the executor is healthy.
func (e *GojaExecutor) Health(ctx context.Context) (bool, error) {
	// Test VM creation
	vm := goja.New()
	_, err := vm.RunString("1 + 1")
	return err == nil, err
}

// UnloadExtension removes an extension from memory.
func (e *GojaExecutor) UnloadExtension(extensionID string) error {
	e.mu.Lock()
	defer e.mu.Unlock()
	
	if _, ok := e.extensions[extensionID]; !ok {
		return fmt.Errorf("extension not loaded: %s", extensionID)
	}
	
	delete(e.extensions, extensionID)
	return nil
}

// ListLoaded returns the IDs of all loaded extensions.
func (e *GojaExecutor) ListLoaded() []string {
	e.mu.RLock()
	defer e.mu.RUnlock()
	
	ids := make([]string, 0, len(e.extensions))
	for id := range e.extensions {
		ids = append(ids, id)
	}
	return ids
}
