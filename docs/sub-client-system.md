# Sub-Client System - Complete Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [Backend Implementation](#backend-implementation)
5. [Frontend Implementation](#frontend-implementation)
6. [API Reference](#api-reference)
7. [Authentication & Authorization](#authentication--authorization)
8. [WhatsApp Integration](#whatsapp-integration)
9. [Migration Guide](#migration-guide)
10. [Troubleshooting](#troubleshooting)

---

## Overview

### What is a Sub-Client?

A **Sub-Client** (also called "workspace") is an isolated environment within a project that provides:

- **Isolated Users**: Each sub-client has its own set of users with separate credentials
- **Public URL**: Each sub-client gets a unique shareable URL (`/s/{short_id}-{pathname}`)
- **WhatsApp Integration**: Individual WhatsApp Business API connections per sub-client
- **Independent Settings**: Registration, suspension, and other settings are configured per sub-client

### Use Cases

| Use Case | Description |
|----------|-------------|
| **Multi-Department** | Separate workspaces for different departments (Sales, Marketing, Support) |
| **Client Portals** | Dedicated workspace for each client with their own users |
| **Team Collaboration** | Isolated environments for different teams within an organization |
| **White-Label Solutions** | Custom domain branding per sub-client |

### Key Features

- **User Isolation**: Users are scoped to individual sub-clients
- **Role-Based Access**: Admin and User roles within each sub-client
- **Public Registration**: Optional self-registration for new users
- **Suspension**: Temporarily disable a sub-client without deletion
- **WhatsApp Integration**: Per-sub-client WhatsApp Business API connections
- **Custom Domains**: Optional custom domain support (future feature)

---

## Architecture

### System Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PROJECT                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Sub-Clients                                │   │
│  │                                                               │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐  │   │
│  │  │ Sub-Client 1    │  │ Sub-Client 2    │  │ Sub-Client 3 │  │   │
│  │  │                 │  │                 │  │              │  │   │
│  │  │ - Users: A,B,C  │  │ - Users: D,E,F  │  │ - Users: G,H │  │   │
│  │  │ - WhatsApp: ✓   │  │ - WhatsApp: ✗   │  │ - WhatsApp: ✓│  │   │
│  │  │ - URL: /s/x7M2- │  │ - URL: /s/a3B9- │  │ - URL: /s/c1D4│  │   │
│  │  │       sales     │  │       marketing  │  │      support│  │   │
│  │  └─────────────────┘  └─────────────────┘  └──────────────┘  │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### URL Structure

```
                    Public Access
                         ↓
          /s/{short_id}-{pathname}/...
                    ↓
        ┌───────────┴───────────┐
        ↓                       ↓
   [Login/Register]        [Chat]
        ↓                       ↓
   Sub-Client Users    Isolated Conversations
```

### Component Relationships

```
┌────────────────────────────────────────────────────────────────────┐
│                        Frontend                                    │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐       │
│  │   Settings   │────▶│  Management  │────▶│    Detail    │       │
│  │              │     │              │     │              │       │
│  │ Project-level│     │ List/Create  │     │ Users/WA/   │       │
│  │ toggles      │     │ sub-clients  │     │ Settings     │       │
│  └──────────────┘     └──────────────┘     └──────────────┘       │
│         ↓                     ↓                     ↓               │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐       │
│  │   Login      │     │  Register    │     │ Route Handler│       │
│  │              │     │              │     │              │       │
│  │ /s/.../login  │     │ /s/.../register│ │ Lookup & Load │       │
│  └──────────────┘     └──────────────┘     └──────────────┘       │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
                           ↕ HTTP/WebSocket
┌────────────────────────────────────────────────────────────────────┐
│                        Backend                                     │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                    API Handlers                               │ │
│  │  sub-client-handler.ts                                        │ │
│  │  - CRUD operations                                           │ │
│  │  - User management                                            │ │
│  │  - Lookup by pathname                                         │ │
│  └──────────────────────────────────────────────────────────────┘ │
│         ↓                     ↓                     ↓               │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐       │
│  │ SubClient    │     │ SubClientUser│     │   SubClient  │       │
│  │ Storage      │     │   Storage    │     │ AuthService  │       │
│  │              │     │              │     │              │       │
│  │ Projects DB  │     │ Projects DB  │     │ Sessions     │       │
│  └──────────────┘     └──────────────┘     └──────────────┘       │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Tables

#### `sub_clients` Table

Stores sub-client configuration and metadata.

```sql
CREATE TABLE sub_clients (
  id TEXT PRIMARY KEY,                    -- Unique ID: scl_{timestamp}_{random}
  project_id TEXT NOT NULL,               -- Parent project
  name TEXT NOT NULL,                     -- Display name
  description TEXT,                       -- Optional description
  whatsapp_client_id TEXT,                -- Linked WhatsApp client ID
  short_id TEXT UNIQUE,                   -- 4-character case-sensitive ID
  pathname TEXT,                          -- URL-friendly path
  custom_domain TEXT UNIQUE,              -- Optional custom domain (future)
  registration_enabled INTEGER NOT NULL DEFAULT 1, -- Allow public signup
  suspended INTEGER NOT NULL DEFAULT 0,   -- Suspension status
  created_at INTEGER NOT NULL,            -- Unix timestamp
  updated_at INTEGER NOT NULL,            -- Unix timestamp
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_sub_clients_project_id ON sub_clients(project_id);
CREATE INDEX idx_sub_clients_short_id ON sub_clients(short_id);
CREATE INDEX idx_sub_clients_pathname ON sub_clients(pathname);
CREATE INDEX idx_sub_clients_custom_domain ON sub_clients(custom_domain);
```

#### `sub_client_users` Table

Stores isolated user credentials for each sub-client.

```sql
CREATE TABLE sub_client_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sub_client_id TEXT NOT NULL,           -- Parent sub-client
  username TEXT NOT NULL,                -- Login username
  email TEXT NOT NULL,                   -- User email
  password_hash TEXT NOT NULL,           -- Bcrypt hash
  role TEXT NOT NULL,                    -- 'admin' or 'user'
  created_at INTEGER NOT NULL,           -- Unix timestamp
  updated_at INTEGER NOT NULL,           -- Unix timestamp
  FOREIGN KEY (sub_client_id) REFERENCES sub_clients(id) ON DELETE CASCADE,
  UNIQUE(sub_client_id, username),       -- Username unique per sub-client
  UNIQUE(sub_client_id, email)           -- Email unique per sub-client
);

-- Indexes
CREATE INDEX idx_sub_client_users_sub_client_id ON sub_client_users(sub_client_id);
CREATE INDEX idx_sub_client_users_sub_client_username ON sub_client_users(sub_client_id, username);
CREATE INDEX idx_sub_client_users_sub_client_email ON sub_client_users(sub_client_id, email);
```

#### `projects` Table (Extensions)

Additional columns for sub-client feature flags.

```sql
-- Columns added to projects table
ALTER TABLE projects ADD COLUMN sub_clients_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN sub_clients_registration_enabled INTEGER NOT NULL DEFAULT 1;
```

### Data Relationships

```
projects (1) ──────┬──── (N) sub_clients
                       │
                       └─────┬──── (N) sub_client_users
```

---

## Backend Implementation

### File Structure

```
backend/src/
├── server/
│   └── sub-client-handler.ts          # API route handlers
├── storage/
│   ├── sub-client-storage.ts          # Sub-client CRUD operations
│   └── sub-client-user-storage.ts     # User management
├── services/
│   └── sub-client-auth-service.ts     # Authentication logic
└── config/
    └── paths.ts                       # Directory helpers
```

### Key Classes

#### SubClientStorage

```typescript
class SubClientStorage {
  // CRUD Operations
  create(data: CreateSubClientData): Promise<SubClient>
  getById(id: string): SubClient | null
  getByProjectId(projectId: string): SubClient[]
  update(id: string, updates: UpdateSubClientData): Promise<SubClient | null>
  delete(id: string): Promise<boolean>

  // Lookup Methods
  getByPathname(pathname: string): SubClient | null
  getByCustomDomain(customDomain: string): SubClient | null
  getByShortIdAndPathname(combined: string): SubClient | null

  // Directory Management
  getDirectories(subClientId, projectId, tenantId)
  ensureDirectories(subClientId, projectId, tenantId)
}
```

#### SubClientUserStorage

```typescript
class SubClientUserStorage {
  // User Management
  create(data: CreateSubClientUserData): Promise<SubClientLocalUser>
  getById(id: number): SubClientLocalUser | null
  getBySubClientId(subClientId: string): SubClientLocalUser[]
  update(id: number, updates: UpdateSubClientUserData): Promise<SubClientLocalUser | null>
  delete(id: number): Promise<boolean>

  // Authentication Helpers
  getByUsername(subClientId, username): SubClientLocalUser | null
  getByEmail(subClientId, email): SubClientLocalUser | null
  getByUsernameOrEmail(subClientId, usernameOrEmail): SubClientLocalUser | null

  // Admin Protection
  countAdmins(subClientId: string): number
  isLastAdmin(userId: number): boolean
}
```

#### SubClientAuthService

```typescript
class SubClientAuthService {
  // Authentication
  register(data): Promise<SubClientAuthResult>
  login(data): Promise<SubClientAuthResult>
  logout(token: string): Promise<void>
  getUserByToken(token: string): Promise<SubClientLocalUser | null>

  // User Management
  changePassword(userId, currentPassword, newPassword): Promise<void>
  updateUserProfile(userId, updates): Promise<void>
  deleteUser(userId: number): Promise<boolean>
}
```

### ID Generation

#### Sub-Client ID

```typescript
// Format: scl_{timestamp}_{random}
// Example: scl_1704067200000_a1b2c3d4e
private generateId(): string {
  const timestamp = Date.now();
  return `scl_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
}
```

#### Short ID

```typescript
// Format: 4 case-sensitive alphanumeric characters
// Example: x7M2, aB9k
// Characters: 0-9, a-z, A-Z (62 possibilities)
// Total combinations: 62^4 = 14,776,336
private generateShortId(): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  // ... generates 4 random characters
  // ... checks for collisions and retries if needed
}
```

#### Pathname

```typescript
// Generated from name: lowercase, hyphens instead of spaces
// Example: "Marketing Department" → "marketing-department"
private generatePathname(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}
```

### Public URL Format

```
Format: /s/{short_id}-{pathname}
Example: /s/x7M2-marketing-department

Parts:
- /s/ : Static prefix for sub-client routes
- short_id : 4-character unique identifier (case-sensitive)
- - : Separator
- pathname : URL-friendly name

Alternative (future):
- Custom domain: marketing.company.com
```

---

## Frontend Implementation

### File Structure

```
frontend/src/
├── components/
│   ├── pages/
│   │   ├── sub-client-settings.tsx    # Project-level settings
│   │   ├── sub-client-management.tsx  # List and create sub-clients
│   │   ├── sub-client-detail.tsx      # Users, WhatsApp, settings
│   │   ├── sub-client-login.tsx       # Public login page
│   │   └── sub-client-register.tsx    # Public registration page
│   └── sub-client/
│       └── sub-client-route-handler.tsx  # Route protection and lookup
├── stores/
│   └── sub-client-store.ts            # Zustand state management
└── lib/
    └── base-path.ts                   # API URL builder
```

### Sub-Client Store (Zustand)

```typescript
interface SubClientStore {
  // State
  subClients: SubClient[]
  currentSubClient: SubClient | null
  isLoading: boolean
  error: string | null
  enabled: boolean

  // Actions
  fetchSubClients(projectId: string): Promise<void>
  createSubClient(projectId, name, description?): Promise<SubClient | null>
  updateSubClientDetails(projectId, subClientId, name, description?): Promise<boolean>
  updateSubClientStatus(projectId, subClientId, suspended): Promise<boolean>
  deleteSubClient(projectId, subClientId): Promise<boolean>
}
```

### Pages

#### 1. Sub-Client Settings (`/projects/{id}/sub-client/settings`)

**Purpose**: Enable/disable sub-clients at project level

**Features**:
- Toggle sub-clients feature on/off
- Set default registration behavior for new sub-clients
- Project owner only

**Key State**:
```typescript
const [enabled, setEnabled] = useState(false)
const [registrationEnabled, setRegistrationEnabled] = useState(true)
```

#### 2. Sub-Client Management (`/projects/{id}/sub-clients/management`)

**Purpose**: List, create, edit, and delete sub-clients

**Features**:
- List view with search and filtering
- Bulk operations (suspend, activate, delete)
- Create dialog with name and description
- Edit dialog for updating details
- Delete with confirmation (requires suspension first)
- Copy public URL to clipboard

**Key Operations**:
```typescript
const handleCreateSubClient = async () => {
  const result = await createSubClient(projectId, name, description)
  // Returns: { id, short_id, pathname, ... }
}

const handleUpdateSubClient = async () => {
  await updateSubClientDetails(projectId, subClientId, name, description, pathname)
}

const handleDeleteSubClient = async () => {
  await deleteSubClient(projectId, subClientId)
  // Only works if suspended === true
}
```

#### 3. Sub-Client Detail (`/projects/{id}/sub-clients/{subClientId}`)

**Purpose**: Configure individual sub-client

**Tabs**:
- **Overview**: General info, registration toggle
- **Users**: Add/remove users, change roles
- **WhatsApp**: Link device, manage connection

**Key Features**:
- User management with role-based permissions
- WhatsApp integration with QR code scanning
- Registration settings override
- Public URL display

#### 4. Sub-Client Login (`/s/{shortPath}/login`)

**Purpose**: Public login page for sub-client users

**Flow**:
1. Extract `shortPath` from URL
2. Lookup sub-client by `short_id-pathname`
3. Display login form with workspace name
4. Authenticate via `subClientLogin()`
5. Redirect to `/s/{shortPath}/chat`

#### 5. Sub-Client Register (`/s/{shortPath}/register`)

**Purpose**: Public registration for new users

**Flow**:
1. Check if registration is enabled
2. Show registration form
3. Create user via `subClientRegister()`
4. Redirect to `/s/{shortPath}/chat`

#### 6. Route Handler (`SubClientRouteHandler`)

**Purpose**: Lookup and validate sub-client from URL

**Responsibilities**:
- Parse `shortPath` from URL
- Call `/api/sub-clients/lookup?shortPath={shortPath}`
- Handle suspended state (logout if authenticated)
- Handle not found state
- Redirect unauthenticated users to login

### TypeScript Types

```typescript
// Sub-Client
interface SubClient {
  id: string
  project_id: string
  name: string
  description: string | null
  whatsapp_client_id: string | null
  short_id: string | null
  pathname: string | null
  custom_domain: string | null
  registration_enabled: boolean
  suspended: boolean
  created_at: number
  updated_at: number
  users?: SubClientUser[]
}

// Sub-Client User
interface SubClientUser {
  id: number
  username: string
  email: string
  role: 'admin' | 'user'
}

// Role Type
type SubClientUserRole = 'admin' | 'user'
```

---

## API Reference

### Base URL

All endpoints are prefixed with `/api`

### Authentication

All endpoints require a valid session cookie except where noted.

### Endpoints

#### Lookup Sub-Client

```http
GET /api/sub-clients/lookup
```

**Query Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| shortPath | string | No* | Combined `short_id-pathname` (e.g., `x7M2-marketing`) |
| host | string | No* | Custom domain (future feature) |

*Either `shortPath` or `host` is required

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "subClient": {
      "id": "scl_1704067200000_a1b2c3d4e",
      "project_id": "A1",
      "name": "Marketing Department",
      "description": "Sales team conversations",
      "short_id": "x7M2",
      "pathname": "marketing-department",
      "registration_enabled": true,
      "suspended": false
    }
  }
}
```

**Errors**:
- `400`: Missing query parameter
- `404`: Sub-client not found
- `400`: Sub-clients not enabled for project

---

#### Get All Sub-Clients

```http
GET /api/projects/{projectId}/sub-clients
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "subClients": [
      {
        "id": "scl_...",
        "name": "Marketing Dept",
        "short_id": "x7M2",
        "pathname": "marketing-dept",
        "suspended": false,
        "registration_enabled": true,
        "users": [
          {
            "id": 1,
            "username": "john",
            "email": "john@example.com",
            "role": "admin"
          }
        ]
      }
    ]
  }
}
```

---

#### Create Sub-Client

```http
POST /api/projects/{projectId}/sub-clients
Content-Type: application/json
```

**Request Body**:
```json
{
  "name": "Marketing Department",
  "description": "Sales team conversations (optional)"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "subClient": {
      "id": "scl_1704067200000_a1b2c3d4e",
      "project_id": "A1",
      "name": "Marketing Department",
      "description": "Sales team conversations",
      "short_id": "x7M2",
      "pathname": "marketing-department",
      "registration_enabled": true,
      "suspended": false,
      "created_at": 1704067200000,
      "updated_at": 1704067200000
    }
  },
  "message": "Sub-client created successfully"
}
```

**Errors**:
- `400`: Sub-clients not enabled
- `403`: Sub-client limit reached
- `400`: Name is required

---

#### Get Sub-Client Details

```http
GET /api/projects/{projectId}/sub-clients/{subClientId}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "subClient": {
      "id": "scl_...",
      "name": "Marketing Dept",
      "description": "...",
      "short_id": "x7M2",
      "pathname": "marketing-dept",
      "registration_enabled": true,
      "suspended": false,
      "users": [...]
    }
  }
}
```

---

#### Update Sub-Client

```http
PUT /api/projects/{projectId}/sub-clients/{subClientId}
Content-Type: application/json
```

**Request Body**:
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "suspended": true
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "subClient": { ... }
  },
  "message": "Sub-client updated successfully"
}
```

---

#### Delete Sub-Client

```http
DELETE /api/projects/{projectId}/sub-clients/{subClientId}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Sub-client deleted successfully"
}
```

**Requirements**:
- Sub-client must be suspended first
- User must be project owner or sub-client admin

---

#### Get Sub-Client Users

```http
GET /api/projects/{projectId}/sub-clients/{subClientId}/users
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": 1,
        "username": "john",
        "email": "john@example.com",
        "role": "admin",
        "created_at": 1704067200000
      }
    ]
  }
}
```

---

#### Create Sub-Client User

```http
POST /api/projects/{projectId}/sub-clients/{subClientId}/users
Content-Type: application/json
```

**Request Body**:
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "SecurePass123",
  "role": "user"
}
```

**Validation**:
- `username`: Required, unique per sub-client
- `email`: Required, unique per sub-client
- `password`: Required, min 8 characters
- `role`: Optional, defaults to "user", must be "admin" or "user"

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 2,
      "username": "johndoe",
      "email": "john@example.com",
      "role": "user",
      "created_at": 1704067200000
    }
  },
  "message": "User created successfully"
}
```

**Errors**:
- `400`: Username/email already exists
- `400`: Password too short
- `403`: Not authorized (not admin)

---

#### Delete Sub-Client User

```http
DELETE /api/projects/{projectId}/sub-clients/{subClientId}/users/{userId}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "User removed successfully"
}
```

**Protection**:
- Cannot delete the last admin
- User cannot delete themselves (UI-level)

---

#### Update User Role

```http
PUT /api/projects/{projectId}/sub-clients/{subClientId}/users/{userId}/role
Content-Type: application/json
```

**Request Body**:
```json
{
  "role": "admin"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "User role updated successfully"
}
```

**Protection**:
- Cannot demote the last admin to user

---

### Sub-Client Authentication Endpoints

#### Sub-Client Login

```http
POST /api/sub-client/login
Content-Type: application/json
```

**Request Body**:
```json
{
  "shortPath": "x7M2-marketing",
  "usernameOrEmail": "john@example.com",
  "password": "userpassword"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "username": "john",
      "email": "john@example.com",
      "role": "admin"
    },
    "session": {
      "token": "...",
      "expiresAt": 1704672000000
    }
  }
}
```

---

#### Sub-Client Registration

```http
POST /api/sub-client/register
Content-Type: application/json
```

**Request Body**:
```json
{
  "shortPath": "x7M2-marketing",
  "email": "newuser@example.com",
  "username": "newuser",
  "password": "SecurePass123"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 2,
      "username": "newuser",
      "email": "newuser@example.com",
      "role": "user"
    },
    "session": {
      "token": "...",
      "expiresAt": 1704672000000
    }
  }
}
```

**Requirements**:
- Sub-client must have `registration_enabled = true`
- Project must have `sub_clients_registration_enabled = true`

---

## Authentication & Authorization

### Session Types

#### Global User Session

```typescript
// Created via /api/login
// Stores in sessions table with user_id
// Can access all projects they have permissions for
{
  user_id: 123,
  type: undefined // or missing
}
```

#### Sub-Client User Session

```typescript
// Created via /api/sub-client/login or /api/sub-client/register
// Stores in sessions table with user_id + context
// Scoped to specific sub-client
{
  user_id: 456,  // References sub_client_users.id
  data: {
    subClientId: "scl_...",
    projectId: "A1",
    type: "sub_client_user"
  }
}
```

### Permission Model

#### Project Owner

- Can enable/disable sub-clients
- Can create unlimited sub-clients (subject to tenant limits)
- Full access to all sub-clients within project
- Can manage users in any sub-client

#### Sub-Client Admin

- Can manage users within their sub-client
- Can update sub-client settings
- Cannot delete the sub-client (unless also project owner)

#### Sub-Client User

- Can access chat and conversations
- Cannot manage other users
- Cannot modify settings

### Authorization Checks

```typescript
// In sub-client-handler.ts

// Check project access
const hasAccess = projectStorage.userHasAccess(projectId, auth.user.id, auth.user.tenant_id);
if (!hasAccess) return 403;

// Check sub-client admin or project owner
const isProjectOwner = projectStorage.getById(projectId)?.user_id === auth.user.id;
let isSubClientAdmin = false;
if (auth.user.isSubClientUser && auth.user.subClientId === subClientId) {
  isSubClientAdmin = auth.user.role === 'admin';
}

if (!isSubClientAdmin && !isProjectOwner) return 403;
```

### Tenant Limits

Sub-clients are subject to tenant-level limits:

```typescript
// In tenant-limits-service.ts
interface TenantLimits {
  maxSubClients: number  // -1 for unlimited
}

// Check before creating
const canCreate = await tenantLimitsService.canCreateSubClient(tenantId, currentCount);
if (!canCreate) {
  return {
    error: "Sub-client limit reached",
    limit: maxSubClients,
    current: currentSubClients.length
  };
}
```

---

## WhatsApp Integration

### Architecture

Each sub-client can have its own WhatsApp Business API connection.

```
┌─────────────────────────────────────────────────────────────┐
│                    Sub-Client                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              WhatsApp Client                          │  │
│  │                                                       │  │
│  │  ┌─────────┐   QR Code   ┌─────────┐   Connected    │  │
│  │  │ Create  │───────────▶│  Scan   │──────────────▶ │  │
│  │  │ Client  │            │  Code   │               │  │
│  │  └─────────┘            └─────────┘               │  │
│  │                                                       │  │
│  │  WebSocket: /api/whatsapp/ws                         │  │
│  │  - Subscribe to updates                              │  │
│  │  - QR code events                                    │  │
│  │  - Connection status                                 │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### WebSocket Events

#### Client → Server

```json
// Subscribe to updates
{
  "type": "subscribe",
  "subClientId": "scl_..."
}

// Unsubscribe
{
  "type": "unsubscribe",
  "subClientId": "scl_..."
}
```

#### Server → Client

```json
// Subscription confirmed
{ "type": "subscribed" }

// Connection status update
{
  "type": "status",
  "data": {
    "subClientId": "scl_...",
    "connected": true,
    "phone": "+6281234567890"
  }
}

// Device connected
{
  "type": "connected",
  "data": {
    "subClientId": "scl_...",
    "phone": "+6281234567890",
    "connectedAt": "2025-02-23T10:30:00.000Z",
    "deviceName": "iPhone 13"
  }
}

// Device disconnected
{
  "type": "disconnected",
  "data": {
    "subClientId": "scl_..."
  }
}

// QR code available
{
  "type": "qr_code",
  "data": {
    "subClientId": "scl_...",
    "qrCode": "2@abc123def456..."
  }
}

// QR code expired
{
  "type": "qr_timeout",
  "data": {
    "subClientId": "scl_..."
  }
}

// Error
{
  "type": "error",
  "data": {
    "error": "Failed to connect to WhatsApp"
  }
}
```

### API Endpoints

#### Get WhatsApp Client

```http
GET /api/whatsapp/client?subClientId={subClientId}
```

**Response** (200 OK):
```json
{
  "success": true,
  "client": {
    "id": "wa_123",
    "phone": "+6281234567890",
    "connected": true,
    "connectedAt": "2025-02-23T10:30:00.000Z",
    "deviceName": "iPhone 13"
  }
}
```

**Response** (404 Not Found):
```json
{
  "success": false,
  "error": "WhatsApp client not found"
}
```

---

#### Create WhatsApp Client

```http
POST /api/whatsapp/client
Content-Type: application/json
```

**Request Body**:
```json
{
  "projectId": "A1",
  "subClientId": "scl_..."
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "client": {
    "id": "wa_123",
    "connected": false
  }
}
```

After creation, subscribe to WebSocket for QR code.

---

#### Get QR Code

```http
GET /api/whatsapp/qr?clientId={clientId}
```

**Response** (200 OK):
```json
{
  "success": true,
  "qrCode": "2@abc123def456..."
}
```

Use the `qrCode` string to generate QR code image client-side.

---

#### Delete WhatsApp Client

```http
DELETE /api/whatsapp/client?clientId={clientId}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "WhatsApp client deleted successfully"
}
```

---

### Frontend Implementation

```typescript
// QR Code generation
import QRCodeLib from 'qrcode';

const qrDataUrl = await QRCodeLib.toDataURL(qrCodeString, {
  width: 256,
  margin: 2,
  color: { dark: "#000000", light: "#FFFFFF" },
});

// Display in <img> tag
<img src={qrDataUrl} alt="WhatsApp QR Code" />

// WebSocket connection
const ws = new WebSocket('ws://host/api/whatsapp/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'subscribe', subClientId }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  switch (message.type) {
    case 'qr_code':
      // Generate and display QR
      break;
    case 'connected':
      // Show success, hide QR
      break;
    case 'qr_timeout':
      // Show expired state
      break;
  }
};
```

---

## Migration Guide

### For New Projects

1. **Enable Sub-Clients**:
   - Go to Project Settings → Sub-Clients Settings
   - Toggle "Enable Sub-Clients"
   - Optionally set "Enable Registration by Default"

2. **Create Sub-Clients**:
   - Go to Sub-Client Management
   - Click "New Sub-Client"
   - Enter name and description
   - System generates `short_id` and `pathname`

3. **Configure Each Sub-Client**:
   - Add users (Admin/User roles)
   - Link WhatsApp device (optional)
   - Configure registration settings

4. **Share Public URL**:
   - Copy URL from sub-client card
   - Share with team/users
   - Users can register/login via public URL

### For Existing Projects

Migrating existing functionality to sub-clients requires careful planning.

#### Data Migration Considerations

```typescript
// 1. Export existing conversations
// Conversations are stored in data/{projectId}/{convId}/

// 2. Export existing users (if reusing credentials)
// Note: Sub-client users are ISOLATED from global users

// 3. Create sub-clients for each team/department
const subClient1 = await subClientStorage.create({
  project_id: projectId,
  name: "Sales Team",
  description: "Sales department conversations"
});

// 4. Recreate users in sub-client
await subClientUserStorage.create({
  sub_client_id: subClient1.id,
  username: "salesuser",
  email: "sales@example.com",
  password_hash: hashedPassword,
  role: "user"
});

// 5. Move conversation data to sub-client directories
// From: data/{projectId}/{convId}/
// To: data/{projectId}/{subClientId}/{convId}/
```

#### Migration Checklist

- [ ] Enable sub-clients in project settings
- [ ] Plan sub-client structure (departments, teams, clients)
- [ ] Create sub-clients for each group
- [ ] Recreate users in each sub-client
- [ ] Migrate conversation history
- [ ] Migrate file attachments
- [ ] Re-link WhatsApp devices
- [ ] Update user documentation with new URLs
- [ ] Test login/registration flows
- [ ] Delete old data after verification

### Importing Users

When importing users from external systems:

```typescript
// Hash passwords before importing
const passwordHash = await Bun.password.hash(plainPassword, {
  algorithm: "bcrypt",
  cost: 10,
});

// Create user
await subClientUserStorage.create({
  sub_client_id: subClientId,
  username: importedUser.username,
  email: importedUser.email,
  password_hash: passwordHash,
  role: importedUser.admin ? "admin" : "user"
});
```

### URL Mapping

If changing URL structure:

```typescript
// Old format: /projects/{id}/conversations
// New format: /s/{shortId}-{pathname}/chat

// Create redirects in backend
if (pathname.match(/^\/projects\/([^\/]+)\/conversations$/)) {
  const projectId = match[1];
  // Find default sub-client for project
  const subClient = subClientStorage.getByProjectId(projectId)[0];
  if (subClient) {
    return Response.redirect(
      `/s/${subClient.short_id}-${subClient.pathname}/chat`,
      301
    );
  }
}
```

---

## Troubleshooting

### Common Issues

#### 1. Sub-Client Not Found

**Symptoms**: 404 error when accessing `/s/{shortPath}`

**Causes**:
- Typo in short_id (case-sensitive!)
- Typo in pathname
- Sub-client was deleted
- Sub-clients not enabled for project

**Solutions**:
```bash
# Check database
sqlite3 data/app/databases/projects.db "SELECT * FROM sub_clients;"

# Verify short_id and pathname
# Remember: short_id is CASE-SENSITIVE
# x7M2 ≠ x7m2
```

#### 2. Registration Disabled

**Symptoms**: "Registration is currently disabled" message

**Causes**:
- Project-level registration disabled
- Sub-client-level registration disabled

**Check**:
```typescript
// Project level
project.sub_clients_registration_enabled  // Must be true

// Sub-client level
subClient.registration_enabled  // Must be true
```

#### 3. Cannot Delete Sub-Client

**Symptoms**: "Only suspended sub-clients can be deleted"

**Solution**:
1. Go to Sub-Client Management
2. Select the sub-client
3. Click "Suspend"
4. Then click "Delete"

#### 4. Last Admin Cannot Be Removed

**Symptoms**: "Cannot remove the last admin" error

**Reason**: Each sub-client must have at least one admin

**Solution**:
1. Promote another user to admin first
2. Then remove the original admin

#### 5. WhatsApp QR Code Not Displaying

**Symptoms**: QR code doesn't appear after linking device

**Troubleshooting**:
```javascript
// Check WebSocket connection
console.log('WebSocket state:', ws.readyState);
// 0 = CONNECTING, 1 = OPEN, 2 = CLOSING, 3 = CLOSED

// Check if subscribed
ws.send(JSON.stringify({ type: 'subscribe', subClientId }));

// Check for QR code message
ws.onmessage = (event) => {
  console.log('Received:', event.data);
};
```

#### 6. User Login Fails

**Symptoms**: "Invalid credentials" error

**Causes**:
- Wrong sub-client (users are isolated!)
- Wrong username/email
- Wrong password
- User in different sub-client

**Debug**:
```bash
# Find user in database
sqlite3 data/app/databases/projects.db \
  "SELECT scu.*, sc.name FROM sub_client_users scu
   JOIN sub_clients sc ON scu.sub_client_id = sc.id
   WHERE scu.username = 'username';"

# Verify password hash (cannot be reversed)
# Only way to reset is to update password_hash
```

#### 7. Sub-Clients Not Showing

**Symptoms**: Management page shows "No sub-clients yet"

**Check**:
1. Sub-clients enabled in project settings?
2. Correct project selected?
3. Database has sub-clients?

```bash
# Check if feature is enabled
sqlite3 data/app/databases/projects.db \
  "SELECT sub_clients_enabled FROM projects WHERE id = 'PROJECT_ID';"

# List sub-clients for project
sqlite3 data/app/databases/projects.db \
  "SELECT * FROM sub_clients WHERE project_id = 'PROJECT_ID';"
```

### Database Queries

#### List All Sub-Clients

```sql
SELECT
  sc.id,
  sc.name,
  sc.short_id,
  sc.pathname,
  sc.suspended,
  sc.registration_enabled,
  p.name as project_name,
  COUNT(scu.id) as user_count
FROM sub_clients sc
JOIN projects p ON sc.project_id = p.id
LEFT JOIN sub_client_users scu ON scu.sub_client_id = sc.id
GROUP BY sc.id
ORDER BY sc.created_at DESC;
```

#### Find Orphaned Users

```sql
-- Users whose sub-client was deleted
SELECT * FROM sub_client_users
WHERE sub_client_id NOT IN (SELECT id FROM sub_clients);
```

#### Sub-Clients Without Admins

```sql
SELECT sc.name, sc.id
FROM sub_clients sc
LEFT JOIN sub_client_users scu
  ON scu.sub_client_id = sc.id AND scu.role = 'admin'
WHERE sc.project_id = 'PROJECT_ID'
GROUP BY sc.id
HAVING COUNT(scu.id) = 0;
```

#### Sub-Clients With WhatsApp

```sql
SELECT
  sc.name,
  sc.short_id,
  sc.pathname,
  sc.whatsapp_client_id
FROM sub_clients sc
WHERE sc.whatsapp_client_id IS NOT NULL
  AND sc.project_id = 'PROJECT_ID';
```

### Performance

#### Indexes

Ensure indexes exist for queries:

```sql
-- Check indexes
PRAGMA index_list('sub_clients');
PRAGMA index_list('sub_client_users');

-- Create if missing
CREATE INDEX IF NOT EXISTS idx_sub_clients_project_id
  ON sub_clients(project_id);
CREATE INDEX IF NOT EXISTS idx_sub_clients_short_id
  ON sub_clients(short_id);
CREATE INDEX IF NOT EXISTS idx_sub_client_users_sub_client_id
  ON sub_client_users(sub_client_id);
```

#### Query Optimization

```typescript
// ❌ Slow: N+1 query
for (const subClient of subClients) {
  subClient.users = userStorage.getBySubClientId(subClient.id);
}

// ✅ Fast: Single query with JOIN
const subClientsWithUsers = db.prepare(`
  SELECT
    sc.*,
    scu.id as user_id,
    scu.username,
    scu.email,
    scu.role
  FROM sub_clients sc
  LEFT JOIN sub_client_users scu ON scu.sub_client_id = sc.id
  WHERE sc.project_id = ?
`).all(projectId);
```

### Logging

```typescript
// Backend logs are stored in data/logs/
// Check for errors:

tail -f data/logs/backend.log | grep -i sub-client
tail -f data/logs/backend.log | grep -i error
```

---

## Best Practices

### Security

1. **Password Requirements**: Enforce minimum 8 characters
2. **HTTPS Only**: Always use HTTPS in production
3. **Session Expiration**: Set reasonable expiration (7 days default)
4. **Rate Limiting**: Implement rate limiting on login/register
5. **Input Validation**: Validate and sanitize all user inputs

### User Management

1. **Always have 2+ admins**: Prevent lockout scenarios
2. **Regular audits**: Review user access periodically
3. **Clear naming**: Use descriptive sub-client names
4. **Document permissions**: Keep track of who can do what

### Performance

1. **Lazy loading**: Load users only when needed
2. **Pagination**: For large user lists
3. **Caching**: Cache sub-client lookup results
4. **Indexing**: Keep database indexes up to date

### UX

1. **Clear URLs**: Use meaningful pathnames
2. **Helpful errors**: Show specific error messages
3. **Confirmation dialogs**: Confirm destructive actions
4. **Loading states**: Show progress during API calls
5. **Empty states**: Guide users when no data exists

---

## Future Enhancements

### Planned Features

1. **Custom Domains**: Full custom domain support per sub-client
2. **User Invitations**: Email invitations instead of manual creation
3. **SSO Integration**: SAML/LDAP for enterprise customers
4. **Audit Logs**: Track all admin actions
5. **Usage Analytics**: Track sub-client usage metrics
6. **API Keys**: Sub-client scoped API keys
7. **Webhooks**: Event notifications for external systems
8. **Theme Customization**: Per-sub-client branding

### Custom Domain Implementation

```typescript
// Future implementation
interface SubClient {
  // ...
  custom_domain: string | null;  // e.g., "marketing.company.com"
  custom_domain_verified: boolean;
  ssl_enabled: boolean;
}

// DNS validation
const verifyDomain = async (domain: string) => {
  // Check TXT record for verification
  const txtRecords = await dns.resolveTxt(domain);
  return txtRecords.some(record =>
    record.includes(`verify=${subClient.id}`)
  );
};
```

---

## Summary

The Sub-Client System provides a powerful multi-tenancy solution within AIBase:

| Feature | Description |
|---------|-------------|
| **Isolation** | Complete user and data separation per sub-client |
| **Scalability** | Support for unlimited sub-clients (subject to limits) |
| **WhatsApp** | Individual WhatsApp connections per workspace |
| **Public Access** | Shareable URLs with optional registration |
| **Admin Tools** | Full user management and configuration |
| **Security** | Role-based access and session management |

For questions or issues, refer to the [Troubleshooting](#troubleshooting) section or check the backend logs.
