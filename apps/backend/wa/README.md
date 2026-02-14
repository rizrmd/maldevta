# WhatsApp Service - Project Integration

## Overview

The WhatsApp service enables each project to have its own dedicated WhatsApp linked device. Each project maintains its own session data, QR codes, and message handlers with full project context integration to the LLM.

## Architecture

### Multi-Project Support

- **One WhatsApp Client Per Project**: Each project gets its own `whatsmeow` client instance
- **Isolated Sessions**: WhatsApp session data is stored in each project's `wa_meta` directory
- **Project-Aware APIs**: All endpoints are scoped to specific projects via path parameters

### Directory Structure

```
data/
  tenants/
    {tenant-id}/
      projects/
        {project-id}/
          wa_meta/              # WhatsApp session data
            whatsmeow.db        # Device session database
          context.md            # Project documentation (used as LLM instructions)
          files/
          chats/
```

## API Endpoints

All endpoints require authentication and are project-scoped.

### Start WhatsApp Connection

**POST** `/projects/:projectID/wa/start`

Starts the WhatsApp connection for a project. If not logged in, initiates a QR code session.

**Response:**
```json
{
  "connected": true,
  "logged_in": true,
  "project_id": "prj_xxxxx",
  "last_qr": "",
  "last_qr_at": "2026-02-14T10:00:00Z",
  "llm_ready": true,
  "llm_error": "",
  "last_error": ""
}
```

### Get QR Code

**GET** `/projects/:projectID/wa/qr`

Retrieves the current QR code for scanning with WhatsApp mobile app.

**Response:**
```json
{
  "code": "base64_qr_code_data",
  "updated_at": "2026-02-14T10:00:00Z",
  "connected": false
}
```

### Check Status

**GET** `/projects/:projectID/wa/status`

Returns the current connection status and LLM availability for a project.

### Send Message

**POST** `/projects/:projectID/wa/send`

Sends a text message to a WhatsApp number.

**Request:**
```json
{
  "to": "+1234567890",
  "message": "Hello from project!"
}
```

**Response:**
```json
{
  "status": "ok"
}
```

### Stop Connection

**POST** `/projects/:projectID/wa/stop`

Disconnects the WhatsApp client for a project.

## LLM Integration

### Automatic Context Loading

When a WhatsApp message is received:

1. **Message Reception**: The service receives the WhatsApp message
2. **Context Loading**: Loads the project's `context.md` file as LLM instructions
3. **LLM Generation**: Sends the message to the LLM with full project context
4. **Response**: Sends the LLM's response back to WhatsApp

### Project Context Structure

```go
ProjectContext {
    ProjectID:    string              // Project identifier
    ProjectName:  string              // Human-readable name
    Instructions: string              // From context.md
    Tone:         string              // "professional", "casual", etc.
    Language:     string              // Output language
    Extensions:   []string            // Extension IDs to apply
    Metadata:     map[string]any      // Additional data
}
```

## Setup Workflow

### 1. Create a Project

Use the IAM service to create a project:

```bash
curl -X POST "http://localhost:9400/projects" \
  -H "Cookie: aicore_session=${SESSION}" \
  -H "Content-Type: application/json" \
  -d '{"name": "Customer Support Bot"}'
```

### 2. Configure Project Context

Update the project's context to define LLM behavior:

```bash
curl -X PUT "http://localhost:9400/projects/${PROJECT_ID}/context" \
  -H "Cookie: aicore_session=${SESSION}" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "# Customer Support Assistant\n\nYou are a friendly customer support assistant. Be helpful and concise."
  }'
```

### 3. Start WhatsApp

Connect the project to WhatsApp:

```bash
curl -X POST "http://localhost:9400/projects/${PROJECT_ID}/wa/start" \
  -H "Cookie: aicore_session=${SESSION}"
```

### 4. Get QR Code

Retrieve the QR code to scan with WhatsApp:

```bash
curl -X GET "http://localhost:9400/projects/${PROJECT_ID}/wa/qr" \
  -H "Cookie: aicore_session=${SESSION}"
```

### 5. Scan with WhatsApp

Open WhatsApp on your phone, go to **Settings → Linked Devices → Link a Device**, and scan the QR code.

## Message Flow

```
WhatsApp User
    ↓ (sends message)
WhatsApp Service
    ↓ (extracts text)
loadProjectContext()
    ↓ (reads context.md)
LLM Service
    ↓ (generates response with context)
WhatsApp Service
    ↓ (sends reply)
WhatsApp User
```

## Features

### Per-Project Isolation

- Each project has independent session storage
- QR codes are project-specific
- Messages are handled with project-specific context
- No cross-contamination between projects

### Automatic Reconnection

- Clients reconnect automatically on restart
- Session data persists in `wa_meta` directory
- No need to re-scan QR code after restarts

### Error Handling

- Connection errors are logged per project
- LLM errors don't crash the service
- Failed messages are logged but don't stop processing

## Implementation Details

### Service Structure

```go
type Service struct {
    mu      sync.RWMutex
    clients map[string]*projectClient // projectID -> client
}

type projectClient struct {
    client    *whatsmeow.Client
    store     *sqlstore.Container
    projectID string
    tenantID  string
    lastQR    string
    lastQRAt  time.Time
    lastError string
}
```

### Client Lifecycle

1. **Lazy Initialization**: Clients are created on first API call
2. **Persistent Storage**: Session data stored in `wa_meta` directory
3. **Event Handling**: Each client has project-aware event handlers
4. **Graceful Shutdown**: Clients disconnect cleanly on stop

## Security Considerations

- **Authentication Required**: All endpoints require valid tenant session
- **Project Isolation**: Users can only access their tenant's projects
- **Session Storage**: WhatsApp session data stored locally per project
- **No Shared State**: Each project has completely isolated WhatsApp identity

## Troubleshooting

### QR Code Not Appearing

- Check project exists and is owned by your tenant
- Ensure WhatsApp client isn't already logged in
- Try stopping and restarting the connection

### Messages Not Generating Responses

- Verify LLM service is configured (check `/llm/status`)
- Ensure `OPENAI_API_KEY` is set
- Check project context exists (`/projects/:id/context`)
- Review `last_error` in status response

### Connection Dropping

- Check WhatsApp is still linked on mobile
- Verify network connectivity
- Review logs for connection errors
- Try reconnecting with `/start` endpoint

## Limitations

- One WhatsApp device per project
- Text messages only (no media support yet)
- No group message support
- No conversation history persistence

## Future Enhancements

- [ ] Media message support (images, videos, documents)
- [ ] Group chat handling
- [ ] Conversation history in project's `chats/` directory
- [ ] Webhook notifications for message events
- [ ] Rich message formatting (bold, italic, lists)
- [ ] Custom extension support per project
