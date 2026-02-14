# LLM Extensions System (Goja-based)

## Overview

The LLM extensions system allows you to extend and customize the LLM pipeline using **JavaScript extensions** that run in-process via [Goja](https://github.com/dop251/goja), a pure Go JavaScript engine.

### Architecture

```
┌──────────────┐
│ LLM Service  │
│  (Go/Encore) │
└──────┬───────┘
       │
       ↓
┌──────────────────┐
│ Goja Executor    │ ← Runs JavaScript in-process
│  (Go Runtime)    │
└──────┬───────────┘
       │
       ↓
┌──────────────────┐
│ JS Extensions    │
│  (index.js)      │
└──────────────────┘
```

**Benefits over HTTP-based runtime:**
- ✅ No external process needed
- ✅ Lower latency (~1ms vs ~10ms)
- ✅ Simpler deployment
- ✅ Better resource management with VM pooling
- ✅ Automatic timeout handling

## Extension Lifecycle

Extensions can hook into three stages of the LLM pipeline:

1. **`pre-generate`** - Transform user prompt before sending to LLM
2. **`post-generate`** - Transform LLM response before returning to user
3. **`validate`** - Validate input meets requirements

## Creating an Extension

### Directory Structure

```
extensions/
  your-extension-name/
    index.js           # Extension code
    extension.json     # Extension metadata
```

### Extension Metadata (extension.json)

```json
{
  "id": "your-extension-name",
  "version": "1.0.0",
  "name": "Your Extension Display Name",
  "description": "What your extension does",
  "hooks": ["pre-generate", "post-generate", "validate"],
  "enabled": true,
  "config": {
    "key": "value"
  }
}
```

### Extension Code (index.js)

Your extension should export functions matching the hooks you declared:

```javascript
/**
 * Pre-generate hook: Transform user prompt
 * @param {Object} request
 * @param {string} request.input - The user's prompt
 * @param {string} request.projectId - Project ID
 * @param {Object} request.context - Additional context
 * @returns {string} - Transformed prompt
 */
function preGenerate(request) {
    // Transform the input
    return request.input.toUpperCase();
}

/**
 * Post-generate hook: Transform LLM response
 * @param {Object} request
 * @param {string} request.input - The LLM's response
 * @returns {string} - Transformed response
 */
function postGenerate(request) {
    // Transform the output
    return request.input;
}

/**
 * Validate hook: Check if input is valid
 * @param {Object} request
 * @returns {Object} - Validation result
 */
function validate(request) {
    return {
        output: JSON.stringify({
            valid: true,
            errors: []
        })
    };
}
```

## Available APIs in Extensions

Extensions run in a sandboxed JavaScript environment with these available APIs:

### Console Logging
```javascript
console.log("Debug message:", value);
```

### Request Object
```javascript
{
  extensionId: "your-extension",
  hook: "pre-generate",
  input: "The prompt or response text",
  projectId: "project-123",
  context: {
    project_name: "My Project",
    metadata: { /* custom data */ }
  }
}
```

### Standard JavaScript
- String methods
- Array methods
- Object manipulation
- Regular expressions
- JSON parsing/stringification
- Math operations

## Using Extensions

### Loading an Extension

Extensions are loaded from the filesystem at startup or on-demand:

```go
executor := extensions.NewGojaExecutor("./extensions")

ext := &extensions.Extension{
    ID:      "example-uppercase",
    Version: "1.0.0",
    Hooks:   []string{"pre-generate"},
    Enabled: true,
}

err := executor.LoadExtension(ctx, ext)
```

### Calling Extensions

Extensions are automatically called when included in the project context:

```json
{
  "prompt": "Hello, world!",
  "project_context": {
    "project_id": "my-project",
    "extensions": ["example-uppercase", "content-filter"]
  }
}
```

## Example Extensions

### 1. Uppercase Transformer

**Location:** `extensions/example-uppercase/`

Simple example that converts prompts to uppercase.

```bash
curl -X POST http://localhost:4000/llm/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "hello world",
    "project_context": {
      "project_id": "test",
      "extensions": ["example-uppercase"]
    }
  }'
```

### 2. Content Filter

**Location:** `extensions/content-filter/`

Validates and filters content for prohibited words.

Features:
- Input validation
- Word filtering
- Length checking
- Output sanitization

## Configuration

### Environment Variables

```bash
# Optional: Custom extensions directory
export EXTENSION_PATH="./custom-extensions"
```

### Executor Configuration

```go
// Create executor with default path (./extensions)
executor := extensions.NewGojaExecutor("")

// Or specify custom path
executor := extensions.NewGojaExecutor("/path/to/extensions")
```

## Performance & Scalability

### VM Pooling

The Goja executor uses a pool of 10 pre-initialized JavaScript VMs for better performance:

- VMs are reused across requests
- Reduces initialization overhead
- Automatic scaling for concurrent requests

### Timeouts

- **Default timeout:** 5 seconds per extension
- **Total timeout:** 30 seconds for all extensions in a request
- Extensions that timeout are skipped with errors logged

### Resource Limits

Each extension runs in an isolated VM with:
- Separate global scope
- No shared state between executions
- Automatic cleanup after execution

## Error Handling

Extensions are designed to fail gracefully:

```go
// If an extension fails, the error is logged but the pipeline continues
fmt.Printf("extension error (hook=%s, ext=%s): %v\n", hookName, extID, err)
```

To see extension errors:
1. Check application logs
2. Use `console.log()` in your extensions
3. Return error information in the response

## Best Practices

### 1. Keep Extensions Small
- Focus on single responsibility
- Avoid complex computations
- Use simple transformations

### 2. Handle Errors Gracefully
```javascript
function preGenerate(request) {
    try {
        return transform(request.input);
    } catch (e) {
        console.log("Error:", e);
        return request.input; // Return original on error
    }
}
```

### 3. Use Type Checking
```javascript
function preGenerate(request) {
    if (typeof request.input !== 'string') {
        return '';
    }
    // ... process string
}
```

### 4. Optimize for Performance
- Avoid regex in loops
- Cache computations when possible
- Return early when possible

### 5. Test Thoroughly
```javascript
// Add console.log for debugging
console.log("Input length:", request.input.length);
console.log("Project:", request.projectId);
```

## Development Workflow

1. **Create Extension Directory**
   ```bash
   mkdir -p extensions/my-extension
   ```

2. **Write Extension Code**
   ```bash
   vim extensions/my-extension/index.js
   ```

3. **Create Metadata**
   ```bash
   vim extensions/my-extension/extension.json
   ```

4. **Test Extension**
   ```bash
   # Start the server
   ./dev.macos
   
   # Test with curl
   curl -X POST http://localhost:4000/llm/generate \
     -H "Content-Type: application/json" \
     -d '{"prompt": "test", "project_context": {"project_id": "test", "extensions": ["my-extension"]}}'
   ```

5. **Debug with Logs**
   - Check `logs/backend.log` for extension output
   - Use `console.log()` liberally during development

## Troubleshooting

### Extension Not Found
```
Error: extension not loaded: my-extension
```
**Solution:** Make sure the extension directory exists at `extensions/my-extension/` and contains `index.js`

### Function Not Found
```
Error: hook function preGenerate not found
```
**Solution:** Ensure your JavaScript file exports the correct function names (camelCase)

### Execution Timeout
```
Error: execution timeout exceeded
```
**Solution:** Optimize your extension code or break it into smaller operations

### JavaScript Errors
```
Error: ReferenceError: variable is not defined
```
**Solution:** Check your JavaScript syntax and use `console.log()` to debug

## Future Enhancements

Planned features:
- [ ] Extension marketplace/registry
- [ ] Hot-reloading of extensions
- [ ] Extension dependencies
- [ ] NPM package support
- [ ] TypeScript support
- [ ] Extension testing framework
- [ ] Performance metrics per extension
- [ ] Circuit breaker for failing extensions

## API Reference

### Executor Interface

```go
type Executor interface {
    Execute(ctx context.Context, req *ExecuteRequest) (*ExecuteResponse, error)
    LoadExtension(ctx context.Context, ext *Extension) error
    Health(ctx context.Context) (bool, error)
}
```

### Goja-Specific Methods

```go
// Unload an extension from memory
func (e *GojaExecutor) UnloadExtension(extensionID string) error

// List all loaded extension IDs
func (e *GojaExecutor) ListLoaded() []string
```

## Security Considerations

⚠️ **Important:** Extensions run with full JavaScript capabilities within the Go process.

### Current Limitations
- No resource limits (CPU/memory)
- No network access restrictions
- No filesystem access restrictions
- No module import restrictions

### Recommendations
1. Only load trusted extensions
2. Review extension code before deployment
3. Run in isolated containers in production
4. Implement extension signing/verification
5. Add resource monitoring

## Support

For issues or questions:
1. Check the example extensions
2. Review application logs
3. Test with simple extensions first
4. Use `console.log()` for debugging

## License

Extensions system is part of the maldevta project.
