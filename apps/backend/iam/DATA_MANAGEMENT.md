# Data Management System

## Overview

The data folder structure supports a multi-tenant architecture with hierarchical organization:

```
data/
  tenants/
    {tenant-id}/
      projects/
        {project-id}/
          context.md          # Project documentation
          files/              # Project-level files
          chats/              # Conversation history
            {conversation-id}.json
          wa_meta/            # WhatsApp session data
            whatsmeow.db      # Device session database
      subs/
        {sub-client-id}/
          files/              # Subclient-level files
          chats/
            {conversation-id}.json
```

## Environment Configuration

The system uses the `DATA_DIR` environment variable to specify the root data directory:

```bash
export DATA_DIR=/path/to/data
```

If `DATA_DIR` is not set, the system defaults to:
- `{executable-directory}/data`

## Directory Initialization

Directories are automatically created when:

1. **Tenant** - Created during the initial `Install` call
2. **Project** - Created when calling `CreateProject` API
3. **Subclient** - Created when calling `CreateSubclient` API

Each directory structure includes:
- `context.md` file (for projects)
- `files/` directory for file storage
- `chats/` directory for conversations

## API Endpoints

### Project APIs

#### Get/Update Project Context
```
GET  /projects/{projectID}/context
PUT  /projects/{projectID}/context
```

#### Conversations
```
POST   /projects/{projectID}/conversations
GET    /projects/{projectID}/conversations
GET    /projects/{projectID}/conversations/{conversationID}
POST   /projects/{projectID}/conversations/{conversationID}/messages
```

### Subclient APIs

#### Conversations
```
POST   /subclients/{subclientID}/conversations
GET    /subclients/{subclientID}/conversations
GET    /subclients/{subclientID}/conversations/{conversationID}
POST   /subclients/{subclientID}/conversations/{conversationID}/messages
```

## Data Models

### Conversation
```json
{
  "id": "conv_xxxxx",
  "title": "Conversation Title",
  "created_at": "2026-02-14T14:45:00Z",
  "updated_at": "2026-02-14T14:45:00Z",
  "messages": [
    {
      "id": "msg_xxxxx",
      "role": "user|assistant|system",
      "content": "Message content",
      "timestamp": "2026-02-14T14:45:00Z"
    }
  ]
}
```

### File Metadata
```json
{
  "name": "document.pdf",
  "path": "/path/to/file",
  "size": 1024,
  "content_type": "application/pdf",
  "created_at": "2026-02-14T14:45:00Z",
  "updated_at": "2026-02-14T14:45:00Z"
}
```

## Authentication & Permissions

- **Tenant Scope**: Can access all projects and subclients within their tenant
- **Subclient Scope**: Can only access conversations and files in their specific subclient
- **Project Admin**: Can create and manage projects within their tenant

## Implementation Details

### Key Functions

- `getTenantPath()` - Returns path to tenant directory
- `getProjectPath()` - Returns path to project directory
- `getSubclientPath()` - Returns path to subclient directory
- `ensureProjectDirs()` - Creates project directory structure
- `ensureSubclientDirs()` - Creates subclient directory structure
- `loadConversation()` - Loads conversation JSON from disk
- `saveConversation()` - Saves conversation JSON to disk

### File Storage

All conversations are stored as JSON files on the filesystem. This approach:
- Allows easy backup and version control
- Supports human-readable format for debugging
- Scales well for the hierarchical structure
- Can be easily migrated to a database later if needed

### ID Generation

- Tenant IDs: `ten_` prefix
- Project IDs: `prj_` prefix
- Subclient IDs: `sub_` prefix
- Conversation IDs: `conv_` prefix
- Message IDs: `msg_` prefix
