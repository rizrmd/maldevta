# Sub-Client Management Page

## Overview
The Sub-Client Management page provides a comprehensive interface for creating, viewing, editing, and managing sub-clients within a project. It includes bulk operations, search functionality, and quick access to individual sub-client configuration.

## Location
- **Route**: `/projects/{projectId}/sub-clients`
- **Component**: [sub-client-management.tsx](../../frontend/src/components/pages/sub-client-management.tsx)
- **Backend Handler**: [sub-client-handler.ts](../../backend/src/server/sub-client-handler.ts)
- **Navigation**: Project Settings → Sub-Clients → Management

## Features

### 1. Sub-Client List Display

Displays all sub-clients within the current project with key information and quick actions.

**Display Information**:
- Sub-client name (clickable to navigate to detail page)
- Description (if provided)
- User count
- Public URL (short_id + pathname)
- Suspension status badge
- WhatsApp integration status badge

**Visual Indicators**:
- **Suspended**: Amber badge with pause icon, reduced opacity
- **WhatsApp Connected**: Green badge with pulsing indicator
- **User Count**: Displayed with users icon

### 2. Create Sub-Client

Creates a new sub-client within the project.

**Dialog Fields**:
- **Name** (required): Display name for the sub-client
- **Description** (optional): Brief description of purpose

**Automatic Generation**:
- `short_id`: Random 4-character alphanumeric string
- `pathname`: Auto-generated from name (lowercase, hyphen-separated)
- `registration_enabled`: Inherited from project default setting

**API Endpoint**:
```http
POST /api/projects/{projectId}/sub-clients
Content-Type: application/json

{
  "name": "Marketing Department",
  "description": "Marketing team conversations"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "subClient": {
      "id": "sub_1234567890_abc123",
      "project_id": "A1",
      "name": "Marketing Department",
      "description": "Marketing team conversations",
      "short_id": "x7m2",
      "pathname": "marketing-department",
      "registration_enabled": true,
      "suspended": false,
      "created_at": 1234567890000
    }
  }
}
```

### 3. Edit Sub-Client

Updates sub-client name, description, and pathname.

**Dialog Fields**:
- **Name**: Edit display name
- **Pathname**: Custom URL path (lowercase, numbers, hyphens only)
- **Description**: Edit description

**Pathname Rules**:
- Pattern: `[a-z0-9-]+`
- Can be left empty to auto-generate from name
- Must be unique across all sub-clients

**API Endpoint**:
```http
PUT /api/projects/{projectId}/sub-clients/{subClientId}
Content-Type: application/json

{
  "name": "Updated Name",
  "description": "Updated description",
  "pathname": "updated-pathname"
}
```

### 4. Bulk Operations

Perform actions on multiple sub-clients simultaneously.

**Selection Mode**:
- Checkbox for each sub-client
- Bulk action toolbar appears when items are selected
- Shows count of selected items

**Bulk Actions**:
- **Suspend**: Temporarily disable multiple sub-clients
- **Activate**: Re-enable suspended sub-clients
- **Delete**: Permanently remove suspended sub-clients

**Bulk Delete Restrictions**:
- Only suspended sub-clients can be deleted
- Button disabled if any selected sub-client is active

### 5. Delete Sub-Client

Permanently removes a sub-client from the project.

**Safety Requirements**:
- Sub-client must be suspended before deletion
- Confirmation dialog required
- Non-deletable status shown in UI

**API Endpoint**:
```http
DELETE /api/projects/{projectId}/sub-clients/{subClientId}
```

**Error Response** (if not suspended):
```json
{
  "success": false,
  "error": "Only suspended sub-clients can be deleted. Please suspend the sub-client first."
}
```

### 6. Search/Filter

Real-time filtering of sub-clients by:

- Name
- Short ID
- Pathname

**Implementation**:
```typescript
const filteredSubClients = subClients.filter((subClient) =>
  subClient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
  subClient.short_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
  subClient.pathname?.toLowerCase().includes(searchQuery.toLowerCase())
);
```

### 7. Public URL

Each sub-client gets a unique public URL for external access.

**URL Format**:
```
https://{domain}/{basePath}/s/{short_id}-{pathname}
```

**Example**:
```
https://example.com/s/x7m2-marketing-dept
```

**Actions**:
- Click URL to open in new tab
- Copy button to copy URL to clipboard
- Visual feedback (check icon) when copied

### 8. Quick Actions

Each sub-client card provides quick action buttons:

| Button | Action | Icon |
|--------|--------|------|
| Copy URL | Copy public URL to clipboard | Copy/Check |
| Edit | Open edit dialog | Edit |
| Manage | Navigate to detail page | ExternalLink |

## State Management

### Sub-Client Store

Uses `useSubClientStore` for state management:

```typescript
interface SubClientStore {
  subClients: SubClient[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchSubClients: (projectId: string) => Promise<void>;
  createSubClient: (projectId: string, name: string, description?: string) => Promise<SubClient | null>;
  updateSubClientDetails: (projectId: string, subClientId: string, name: string, description?: string, pathname?: string) => Promise<boolean>;
  updateSubClientStatus: (projectId: string, subClientId: string, suspended: boolean) => Promise<boolean>;
  deleteSubClient: (projectId: string, subClientId: string) => Promise<boolean>;
}
```

### Local State

```typescript
const [createDialogOpen, setCreateDialogOpen] = useState(false);
const [editDialogOpen, setEditDialogOpen] = useState(false);
const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
const [searchQuery, setSearchQuery] = useState("");
const [selectedSubClients, setSelectedSubClients] = useState<Set<string>>(new Set());
const [copiedId, setCopiedId] = useState<string | null>(null);
```

## UI Components

### Header Structure

```tsx
<Header>
  <HeaderLeft>
    <HeaderTitle>Sub-Clients</HeaderTitle>
  </HeaderLeft>
  <HeaderRight>
    {selectedSubClients.size > 0 ? (
      // Bulk actions toolbar
    ) : (
      // Search and create button
    )}
  </HeaderRight>
</Header>
```

### Sub-Client Card

```tsx
<Card className={subClient.suspended ? 'opacity-70 bg-muted/50' : ''}>
  <div className="flex items-center gap-3">
    {/* Checkbox for bulk selection */}
    <Checkbox checked={selected} onCheckedChange={toggleSelection} />

    {/* Content */}
    <div className="space-y-1">
      <button onClick={navigateToDetail}>
        {subClient.name}
      </button>

      {/* Status badges */}
      {subClient.suspended && <Badge>Suspended</Badge>}
      {subClient.whatsapp_client_id && <Badge>WhatsApp</Badge>}

      {/* Description */}
      <p className="text-sm text-muted-foreground">
        {subClient.description}
      </p>

      {/* Metadata */}
      <div className="flex items-center gap-3 text-xs">
        <Users /> {userCount} users
        <Link2 /> {publicUrl}
      </div>
    </div>

    {/* Actions */}
    <Button onClick={copyUrl}>Copy</Button>
    <Button onClick={edit}>Edit</Button>
    <Button onClick={navigateToDetail}>Manage</Button>
  </div>
</Card>
```

### Bulk Actions Toolbar

```tsx
<div className="flex items-center gap-2">
  <span>{selectedSubClients.size} selected</span>

  <Button onClick={() => handleBulkStatusChange(true)}>
    <Pause /> Suspend
  </Button>

  <Button onClick={() => handleBulkStatusChange(false)}>
    <Play /> Activate
  </Button>

  <Button
    variant="destructive"
    onClick={() => openDeleteDialog()}
    disabled={hasNonSuspended}
  >
    <Trash2 /> Delete
  </Button>

  <Button onClick={() => setSelectedSubClients(new Set())}>
    <X /> Clear
  </Button>
</div>
```

## API Reference

### List Sub-Clients

```http
GET /api/projects/{projectId}/sub-clients
```

**Response**:
```json
{
  "success": true,
  "data": {
    "subClients": [
      {
        "id": "sub_123",
        "project_id": "A1",
        "name": "Marketing",
        "description": "...",
        "short_id": "x7m2",
        "pathname": "marketing",
        "registration_enabled": true,
        "suspended": false,
        "whatsapp_client_id": "wa_123",
        "users": [
          {
            "id": 1,
            "username": "john",
            "email": "john@example.com",
            "role": "admin"
          }
        ],
        "created_at": 1234567890000,
        "updated_at": 1234567890000
      }
    ],
    "enabled": true
  }
}
```

### Update Sub-Client Status

```http
PUT /api/projects/{projectId}/sub-clients/{subClientId}
Content-Type: application/json

{
  "suspended": true
}
```

## Empty States

### No Sub-Clients

```tsx
<Card>
  <CardContent className="py-12 text-center">
    <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
    <p>No sub-clients yet</p>
    <p className="text-sm text-muted-foreground">
      Create your first sub-client to get started
    </p>
  </CardContent>
</Card>
```

### No Search Results

```tsx
<p className="text-muted-foreground">
  No matching sub-clients found
</p>
```

## Loading States

```tsx
{isLoading ? (
  <div className="flex items-center justify-center py-12">
    <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
  </div>
) : (
  // Sub-client list
)}
```

## Toast Notifications

| Event | Message |
|-------|---------|
| Create success | "Sub-client created! URL: /s/{short_id}-{pathname}" |
| Update success | "Sub-client updated successfully" |
| Delete success | "Sub-client deleted successfully" |
| Bulk delete | "Deleted {count} sub-clients" |
| Bulk suspend | "Suspended {count} sub-clients" |
| Bulk activate | "Activated {count} sub-clients" |
| URL copied | "URL copied to clipboard" |
| Name required | "Name is required" |
| Failed | "Failed to {action}" |

## Permission Model

### Access Requirements

- User must be authenticated
- User must have access to the parent project
- Sub-clients feature must be enabled for the project

### Edit/Delete Permissions

```typescript
// From backend handler
const isProjectOwner = projectStorage.getById(projectId)?.user_id === auth.user.id;
const isSubClientAdmin = auth.user.isSubClientUser &&
                         auth.user.subClientId === subClientId &&
                         auth.user.role === 'admin';

if (!isSubClientAdmin && !isProjectOwner) {
  return Response.json({ error: "Access denied" }, { status: 403 });
}
```

### Delete Restriction

```typescript
// Only suspended sub-clients can be deleted
if (!subClient.suspended) {
  return Response.json({
    error: "Only suspended sub-clients can be deleted"
  }, { status: 400 });
}
```

## Tenant Limits

When creating sub-clients, the system checks tenant limits:

```typescript
const currentSubClients = subClientStorage.getByProjectId(projectId).length;
const canCreate = await tenantLimitsService.canCreateSubClient(
  tenantId,
  currentSubClients
);

if (!canCreate) {
  return Response.json({
    error: "Sub-client limit reached",
    limit: maxSubClients,
    current: currentSubClients
  }, { status: 403 });
}
```

## Related Pages

- [Sub-Client Settings](./sub-client-settings.md) - Enable/disable feature at project level
- [Sub-Client Detail](./sub-client-detail.md) - Individual sub-client configuration
- [Project Settings](./project-settings.md) - General project configuration

## Usage Flow

### Create Sub-Client Flow

1. User clicks "New Sub-Client" button
2. Create dialog opens
3. User enters name and optional description
4. System validates input
5. API call creates sub-client
6. Store updates with new sub-client
7. Toast shows success with public URL
8. Dialog closes and form resets

### Bulk Delete Flow

1. User selects multiple sub-clients via checkboxes
2. Bulk toolbar appears with selection count
3. User clicks "Delete" button
4. System validates all are suspended (button disabled otherwise)
5. Confirmation dialog opens
6. User confirms deletion
7. API calls delete each sub-client sequentially
8. Store updates removing deleted items
9. Toast shows count of deleted items
10. Selection is cleared

## Best Practices

1. **Always suspend before deleting**: Enforce this pattern in UI
2. **Show clear feedback**: Toast notifications for all actions
3. **Disable invalid actions**: Gray out buttons when operations aren't allowed
4. **Provide visual indicators**: Badges for status, icons for actions
5. **Maintain context**: Keep selection state during operations
6. **Handle errors gracefully**: Show specific error messages
7. **Optimistic updates**: Update UI immediately, rollback on error

## Troubleshooting

### Sub-client creation fails

- Verify sub-clients are enabled for the project
- Check tenant limits for maximum sub-clients
- Ensure user has project access

### Bulk actions not working

- Verify all selected sub-clients exist
- Check that user has admin permissions
- Ensure sub-clients are suspended before delete

### Public URL not accessible

- Verify `short_id` and `pathname` are set
- Check project has sub-clients enabled
- Ensure sub-client is not suspended

### Search not finding results

- Check search query is lowercase for IDs
- Verify pathname is being searched correctly
- Ensure state is being filtered properly
