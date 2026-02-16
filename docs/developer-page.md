# Developer Page Documentation

## Overview

The Developer page provides admin-level tools for integrating and extending the AI Base platform. It is located under the **Management** section in the sidebar and contains three sub-pages:

1. **API** - One-shot LLM completion endpoint documentation and playground
2. **Embed** - Widget configuration for embedding chat on external websites
3. **Extensions** - Custom tool management for extending LLM capabilities

## Access Control

- **Role Required**: Admin only
- **Route**: `/projects/:projectId/developer`
- **Navigation**: Sidebar → Management → Developer

---

## 1. API Page (`/projects/:projectId/api`)

**File**: [developer-api.tsx](../frontend/src/components/pages/developer-api.tsx)

### Purpose

Provides documentation and an interactive playground for the one-shot LLM completion API endpoint. This allows external applications to send single prompts and receive responses without managing conversation state.

### Features

- **API Documentation**: HTTP endpoint specification with request/response format
- **Code Examples**: cURL and JavaScript sample implementations
- **API Playground**: Interactive test interface directly in the browser

### Layout Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  API Reference                                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────┐  ┌───────────────────────────────────┐  │
│  │  One-Shot Completion        │  │  API Playground                   │  │
│  │  Documentation             │  │  ┌─────────────────────────────┐  │  │
│  │  - Endpoint: POST          │  │  │ Context (Optional)          │  │  │
│  │    /api/llm/completion    │  │  │ [input field]               │  │  │
│  │                           │  │  │                             │  │  │
│  │  Request Body:            │  │  │ Prompt                      │  │  │
│  │  - prompt (required)      │  │  │ [textarea]                  │  │  │
│  │  - context (optional)     │  │  │                             │  │  │
│  │                           │  │  │ [Run Request]                │  │  │
│  │  Usage Examples:           │  │  │                             │  │  │
│  │  [cURL | JavaScript]       │  │  │ Response:                   │  │  │
│  │                           │  │  │ [JSON output]                │  │  │
│  └─────────────────────────────┘  └─────────────────────────────┘  │  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### API Endpoint Specification

**Request:**
```bash
POST /api/llm/completion
Content-Type: application/json

{
  "prompt": "Hello, how are you?",
  "context": "You are a helpful assistant"
}
```

**Response:**
```json
{
  "success": true,
  "response": "AI response here..."
}
```

### Request Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `prompt` | string | Yes | The user instruction or question |
| `context` | string | No | Additional system instructions |

### State Management

| State | Type | Purpose |
|-------|------|---------|
| `context` | `string` | Optional system instruction |
| `prompt` | `string` | User input for the LLM |
| `response` | `any` | API response data |
| `isLoading` | `boolean` | Request in progress |
| `copied` | `string \| null` | Which code snippet was copied |

### How It Works

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Browser   │         │   Frontend   │         │   Backend   │
│  (User UI)  │         │  (React)     │         │  (Server)   │
└──────┬──────┘         └──────┬───────┘         └──────┬──────┘
       │                       │                        │
       │  1. User enters        │                        │
       │     prompt + context   │                        │
       ├───────────────────────>│                        │
       │                       │                        │
       │  2. Click "Run     │                        │
       │     Request"          │                        │
       ├───────────────────────>│                        │
       │                       │                        │
       │                       │  3. POST /api/llm/completion │
       │                       │  {prompt, context}           │
       │                       ├───────────────────────────>│
       │                       │                        │
       │                       │                        │  4. Process with
       │                       │                        │     LLM API
       │                       │                        │  (OpenAI/etc)
       │                       │                        ├───────────>
       │                       │                        │<───────────
       │                       │                        │
       │                       │  5. Response {success, response} │
       │                       │<────────────────────────────│
       │                       │                        │
       │  6. Display JSON    │                        │
       │     response          │                        │
       │<──────────────────────│                        │
       │                       │                        │
```

### Step-by-Step Workflow

1. **User Input**
   - User enters optional context (system instructions)
   - User enters prompt (question/task for LLM)
   - Clicks "Run Request" button

2. **Request Preparation**
   - Frontend validates prompt is not empty
   - Sets `isLoading = true`
   - Shows loading spinner

3. **API Call**
   ```javascript
   POST /api/llm/completion
   Headers: { "Content-Type": "application/json" }
   Body: {
     prompt: "...",
     context: "..." // optional
   }
   ```

4. **Backend Processing**
   - Backend receives request
   - Calls LLM API (OpenAI, OpenRouter, etc.)
   - Processes the prompt with optional context
   - Returns response

5. **Response Handling**
   - Frontend receives JSON response
   - Sets `response` state with result
   - Sets `isLoading = false`

6. **Display Result**
   - Response shown in formatted JSON
   - Success toast displayed
   - If error, shows error toast

### Code Examples

**cURL:**
```bash
curl -X POST https://your-domain.com/api/llm/completion \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Hello, how are you?",
    "context": "You are a helpful assistant"
  }'
```

**JavaScript:**
```javascript
const response = await fetch("https://your-domain.com/api/llm/completion", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    prompt: "Hello, how are you?",
    context: "You are a helpful assistant"
  })
});

const data = await response.json();
console.log(data.response);
```

---

## 2. Embed Page (`/projects/:projectId/embed`)

**File**: [embed-settings.tsx](../frontend/src/components/pages/embed-settings.tsx)

### Purpose

Configure and generate embed code for integrating the chat widget into external websites. Supports both iframe and JavaScript integration methods.

### Features

| Tab | Features |
|-----|----------|
| **Config** | Conversation history toggle, user identification mode, CORS allowed domains |
| **CSS** | Custom CSS editor for widget styling (max 10KB) |
| **Code** | Embed token display, dimensions, code type selection, generated embed code |

### Layout Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Embed Settings                                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  [Config | CSS | Code]                                                  │
│                                                                          │
│  Config Tab:                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │ Display Options                                                  │    │
│  │ ☐ Show Conversation History                                     │    │
│  │                                                                  │    │
│  │ User Identification                                              │    │
│  │ [Current User ▼]                                                │    │
│  │                                                                  │    │
│  │ Allowed Domains (CORS)                                           │    │
│  │ [textarea - one domain per line]                                  │    │
│  │                                              [Save Configuration]│    │
│  └────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### User Identification Modes

| Mode | Description | UID Parameter | History |
|------|-------------|---------------|---------|
| **Current User** | All embedded users share the same conversation history | Not used | Shared |
| **By UID Param** | Each user has their own isolated conversation history | `uid=user123` | Per-user |

### Embed Token

The embed token is simply the **project ID**. It's used to authorize access to the embedded chat widget.

### Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `show_history` | boolean | Show sidebar with conversation list (only when UID mode is enabled) |
| `use_client_uid` | boolean | Enable per-user history via UID parameter |
| `allowed_origins` | string[] | CORS allowed domains (one per line, empty = allow all) |
| `customCss` | string | Custom CSS for widget styling (max 10240 chars) |

### Generated Code Examples

**iframe:**
```html
<iframe
  src="https://domain.com/embed?projectId=xxx&embedToken=xxx"
  width="400px"
  height="600px"
  frameborder="0"
  allow="microphone"
  style="border: 1px solid #ccc; border-radius: 8px;"
></iframe>
```

**JavaScript:**
```html
<div id="aibase-chat"></div>
<script>
(function() {
  const iframe = document.createElement('iframe');
  iframe.src = 'https://domain.com/embed?projectId=xxx&embedToken=xxx';
  iframe.width = '400px';
  iframe.height = '600px';
  iframe.frameBorder = '0';
  iframe.allow = 'microphone';
  iframe.style.cssText = 'border: 1px solid #ccc; border-radius: 8px;';
  document.getElementById('aibase-chat').appendChild(iframe);
})();
<\/script>
```

### UID Parameter Example

For per-user history mode:

```html
<iframe
  src="https://domain.com/embed?projectId=xxx&embedToken=xxx&uid=user123"
  width="400px"
  height="600px"
></iframe>
```

### State Management

| State | Type | Purpose |
|-------|------|---------|
| `embedToken` | `string \| null` | Project ID as embed token |
| `customCss` | `string` | Custom CSS for widget |
| `showHistory` | `boolean` | Show conversation history sidebar |
| `userMode` | `"current" \| "uid"` | User identification mode |
| `allowedOrigins` | `string` | CORS allowed domains (newline-separated) |
| `codeType` | `"iframe" \| "javascript"` | Generated code type |
| `width` | `string` | Widget width |
| `height` | `string` | Widget height |
| `isLoading` | `boolean` | Loading settings |
| `isSaving` | `boolean` | Saving changes |

### How It Works

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Browser   │         │   Frontend   │         │   Backend   │
│  (User UI)  │         │  (React)     │         │  (Server)   │
└──────┬──────┘         └──────┬───────┘         └──────┬──────┘
       │                       │                        │
       │  1. Page Load        │                        │
       ├───────────────────────>│                        │
       │                       │                        │
       │                       │  2. GET /embed/css      │
       │                       ├───────────────────────────>│
       │                       │                        │
       │                       │  3. Return customCss    │
       │                       │<────────────────────────────│
       │                       │                        │
       │  4. User changes     │                        │
       │     config/CSS       │                        │
       ├───────────────────────>│                        │
       │                       │                        │
       │                       │  5. POST/PUT to save  │
       │                       ├───────────────────────────>│
       │                       │                        │
       │                       │  6. Generate embed     │
       │                       │     code with token     │
       │  7. Copy code       │                        │
       │<──────────────────────│                        │
       │                       │                        │
       │                       │                        │
       │  8. Paste to        │     External Website       │
       │     external site     │<───────────────────────>│
       │                       │                        │
       │                       │                        │
       │  9. Widget loads     │                        │
       │     with projectId     │                        │
       │     + embedToken      │                        │
       ├───────────────────────>                        │
       │                       │                        │
```

### Step-by-Step Workflow

#### Initial Load Flow

1. **Component Mount**
   - Page loads with project ID from URL
   - `loadEmbedSettings()` triggered

2. **Fetch Settings**
   ```javascript
   GET /api/projects/:id/embed/css
   GET /api/projects/:id  (for config)
   ```
   - Backend returns project settings + custom CSS
   - `embedToken` set to project ID
   - `showHistory`, `userMode`, `allowedOrigins` populated

3. **Render UI**
   - Settings displayed in 3 tabs (Config, CSS, Code)
   - Embed code generated based on current settings

#### Configuration Save Flow

4. **User Changes Settings**
   - Toggle show history
   - Change user identification mode
   - Add/remove allowed origins

5. **Save Configuration**
   ```javascript
   PUT /api/projects/:id
   Body: {
     show_history: boolean,
     use_client_uid: boolean,
     allowed_origins: string[]
   }
   ```
   - Frontend sends updates to backend
   - Project updated in database
   - `useProjectStore` updated with new data
   - Success toast displayed

#### CSS Save Flow

6. **User Edits CSS**
   - Types in textarea (max 10240 chars)
   - Character counter updates in real-time

7. **Save CSS**
   ```javascript
   POST /api/projects/:id/embed/css
   Body: { customCss: string }
   ```
   - Frontend validates length
   - Sends to backend
   - CSS saved to database/storage
   - Success toast displayed

#### Code Generation & Copy Flow

8. **Generate Embed Code**
   - When user changes dimensions or code type
   - `generateIframeCode()` or `generateJavaScriptCode()` called
   - URL constructed: `origin/basePath/embed?projectId=X&embedToken=Y`
   - Code generated with current settings

9. **User Copies Code**
   - Clicks "Copy" button
   - `navigator.clipboard.writeText(embedCode)`
   - Toast: "Embed code copied to clipboard!"

10. **External Integration**
   - User pastes code into their website HTML
   - Widget loads in iframe with project credentials
   - Chat widget connects to AI Base platform

### User Mode Behavior

#### Current User Mode (Shared)
```
External Site A (uid: none) ──┐
                                ├──> Shared Conversation History
External Site B (uid: none) ──┘     (all users see same)
```

#### UID Mode (Per-User)
```
External Site A (uid: user123) ──┐
                                  ├──> Separate Conversation History
External Site B (uid: user456) ──┘     (each uid isolated)
```

### Security Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  External Website                                            │
│  <iframe src=".../embed?projectId=X&embedToken=Y&uid=Z">    │
└────────────────────┬────────────────────────────────────────────┘
                   │
                   │ 1. Request with embed token
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│  AI Base Backend                                            │
│  ┌───────────────────────────────────────────────────────┐    │
│  │ 1. Validate projectId = embedToken              │    │
│  │ 2. Check allowed_origins (if configured)         │    │
│  │ 3. If UID mode: validate uid parameter          │    │
│  │ 4. Load project context + history               │    │
│  └───────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### API Endpoints Used

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/projects/:id/embed/css` | Load custom CSS |
| POST | `/api/projects/:id/embed/css` | Save custom CSS |
| PUT | `/api/projects/:id` | Save configuration |

---

## 3. Extensions Page (`/projects/:projectId/extensions`)

**File**: [extensions-settings.tsx](../frontend/src/components/pages/extensions-settings.tsx)

### Purpose

Manage project-specific extensions that extend the LLM's capabilities with custom tools and UI components.

### Features

| Feature | Description |
|---------|-------------|
| **Search** | Filter extensions by name/description |
| **Category Tabs** | Filter extensions by category |
| **Extension Cards** | Display extension metadata and controls |
| **Toggle** | Enable/disable extensions |
| **Reload** | Clear caches and reload extension code |
| **Debug Mode** | Enable logging for troubleshooting |
| **Debug Logs Viewer** | View frontend and backend logs |
| **Change Category** | Move extension to different category |
| **Delete** | Remove custom extensions |
| **Reset to Defaults** | Restore all default extensions |

### Layout Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Extensions                                            [Search...] [Reset]│
├─────────────────────────────────────────────────────────────────────────────┤
│  [All Extensions] [Category 1] [Category 2] ...                         │
│                                                                          │
│  ┌─────────────────────────┐  ┌─────────────────────────┐              │
│  │ 🧩 Extension Name       │  │ 🧩 Another Extension   │              │
│  │ Description...          │  │ Description...          │              │
│  │ v1.0.0 • author        │  │ v1.0.0                │              │
│  │ [Custom] [Enabled]      │  │ [Built-in] [Disabled]  │              │
│  │ 🔒 Capabilities (2)      │  │                        │              │
│  │                        │  │                        │              │
│  │ [Disable] [↻] [🐞] [≡] [🗑]                    │              │
│  └─────────────────────────┘  └─────────────────────────┘              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Extension Card Elements

| Element | Description |
|---------|-------------|
| **Icon** | 🧩 puzzle piece, colored when enabled |
| **Name/Description** | Extension metadata |
| **Version/Author** | Extension info |
| **Badges** | Custom, Built-in, Disabled, Error, Debug |
| **Capabilities** | Collapsible list of required permissions |
| **Actions** | Enable/Disable, Reload, Debug, Category, Delete |

### Action Buttons

| Button | Icon | Purpose |
|--------|-------|---------|
| Enable/Disable | ⏤/⏵ | Toggle extension state |
| Reload | ↻ | Clear caches and reload code |
| Debug | 🐛 | Toggle debug mode |
| Change Category | ≡ | Move to different category |
| Delete | 🗑 | Remove extension (custom only) |

### Debug Logs Viewer

When debug mode is enabled and expanded:

```
┌─────────────────────────────────────────────────────────────────────┐
│ [Frontend] [Backend]                    [Refresh]                 │
│                                                                     │
│ ┌───────────────────────────────────────────────────────────────────┐ │
│ │ INFO  UI  10:30:45                                              │ │
│ │ Extension initialized successfully                                 │ │
│ └───────────────────────────────────────────────────────────────────┘ │
│ ┌───────────────────────────────────────────────────────────────────┐ │
│ │ ERROR UI  10:31:12                                             │ │
│ │ Failed to fetch data                                            │ │
│ │ ▸ View details                                                  │ │
│ └───────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Dialogs

1. **Reset Confirmation**: Warns that all custom extensions will be deleted
2. **Change Category**: Select new category from dropdown
3. **Delete Confirmation**: Final warning before deletion

### Extension Type Definition

```typescript
interface ExtensionMetadata {
  id: string;
  name: string;
  description: string;
  author?: string;
  version: string;
  category: string;
  enabled: boolean;
  isDefault: boolean;
  capabilities?: string[];
  errorCount?: number;
  lastError?: string;
  hasError?: boolean;
  debug?: boolean;
}

interface Extension {
  metadata: ExtensionMetadata;
  code: string;      // Backend execution code
  ui?: string;        // Frontend UI component (optional)
}
```

### State Management

| State | Type | Purpose |
|-------|------|---------|
| `extensions` | `Extension[]` | All extensions |
| `categoryGroups` | `CategoryGroup[]` | Extensions grouped by category |
| `searchTerm` | `string` | Filter text |
| `activeCategoryTab` | `string` | Selected category filter |
| `reloadingExtensions` | `Set<string>` | Extensions being reloaded |
| `expandedDebugLogs` | `Set<string>` | Extensions with logs visible |
| `debugLogsTab` | `Record<string, 'frontend'\|'backend'>` | Log tab per extension |
| `backendLogs` | `Record<string, any[]>` | Backend log entries |
| `frontendLogs` | `Record<string, any[]>` | Frontend log entries |

### API Endpoints Used

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/projects/:id/extensions` | List extensions |
| GET | `/api/categories` | List categories |
| POST | `/api/projects/:id/extensions/:id/toggle` | Enable/disable |
| POST | `/api/projects/:id/extensions/:id/reload` | Reload extension |
| PATCH | `/api/projects/:id/extensions/:id/debug` | Toggle debug mode |
| GET | `/api/projects/:id/extensions/:id/debug` | Get debug logs |
| PUT | `/api/projects/:id/extensions/:id` | Update extension |
| DELETE | `/api/projects/:id/extensions/:id` | Delete extension |
| POST | `/api/projects/:id/extensions/reset` | Reset to defaults |

### How It Works

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐         ┌──────────────┐
│   Browser   │         │   Frontend   │         │   Backend   │         │  Extension  │
│  (User UI)  │         │  (React)     │         │  (Server)   │         │   Worker     │
└──────┬──────┘         └──────┬───────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                        │                        │
       │  1. Page Load       │                        │                        │
       ├───────────────────────>│                        │                        │
       │                       │                        │                        │
       │                       │  2. GET /extensions   │                        │
       │                       │     GET /categories   │                        │
       │                       ├───────────────────────────>│                        │
       │                       │                        │                        │
       │                       │  3. Return list      │                        │
       │                       │<────────────────────────────│                        │
       │                       │                        │                        │
       │  4. User clicks     │                        │                        │
       │     "Enable"        │                        │                        │
       ├───────────────────────>│                        │                        │
       │                       │                        │                        │
       │                       │  5. POST /toggle     │                        │
       │                       ├───────────────────────────>│                        │
       │                       │                        │                        │
       │                       │  6. Clear cache      │                        │
       │                       │     Reload extension   │                        │
       │                       ├─────────────────────────────────────────────────>│
       │                       │                        │                        │
       │                       │                        │  7. Extension ready       │
       │                       │                        │<────────────────────────────│
       │                       │                        │                        │
       │  8. User enables     │                        │                        │
       │     Debug mode       │                        │                        │
       ├───────────────────────>│                        │                        │
       │                       │                        │                        │
       │                       │  9. PATCH /debug     │                        │
       │                       ├───────────────────────────>│                        │
       │                       │                        │                        │
       │                       │  10. Start logging   │                        │
       │                       ├─────────────────────────────────────────────────>│
       │                       │                        │                        │
       │                       │                        │  11. Logs collected      │
       │                       │                        │<────────────────────────────│
       │                       │                        │                        │
       │                       │  12. GET /debug      │                        │
       │                       ├───────────────────────────>│                        │
       │                       │                        │                        │
       │                       │  13. Return logs      │                        │
       │                       │<────────────────────────────│                        │
       │                       │                        │                        │
       │  14. Display logs    │                        │                        │
       │<──────────────────────│                        │                        │
```

### Step-by-Step Workflow

#### Initial Load Flow

1. **Component Mount**
   - Page loads with project ID
   - `loadData()` triggered

2. **Fetch Data**
   ```javascript
   GET /api/projects/:id/extensions
   GET /api/categories
   ```
   - Backend returns all extensions for project
   - Backend returns all categories
   - Extensions grouped by category
   - "Uncategorized" group added for extensions without category

3. **Render Cards**
   - Each extension rendered as card
   - Badges shown: Custom, Built-in, Enabled, Disabled, Error, Debug
   - Capabilities collapsed by default

#### Enable/Disable Flow

4. **User Clicks Toggle**
   - Button shows "Disable" if enabled
   - Button shows "Enable" if disabled

5. **Send Toggle Request**
   ```javascript
   POST /api/projects/:id/extensions/:extId/toggle
   ```
   - Frontend optimistically updates UI
   - Extension metadata updated with new `enabled` state

6. **Backend Processing**
   - Updates extension in database
   - Clears extension from cache
   - Returns updated extension

7. **UI Update**
   - Card border changes (green if enabled)
   - Button text/icon updated
   - Success toast: "Extension enabled" / "Extension disabled"

#### Reload Flow

8. **User Clicks Reload**
   - Reload button with ↻ icon
   - Only available for enabled extensions

9. **Send Reload Request**
   ```javascript
   POST /api/projects/:id/extensions/:extId/reload
   ```
   - `reloadingExtensions` set adds extension ID
   - Spinner shows on reload button

10. **Backend Cache Clear**
   - Clears extension from memory cache
   - Clears frontend component cache
   - Extension code re-evaluated
   - Returns success message

11. **Frontend Cache Clear**
   ```javascript
   import { clearExtensionComponentCache } from "@/components/ui/chat/tools/extension-component-registry"
   clearExtensionComponentCache(extensionId, projectId)
   ```
   - Frontend removes cached UI component
   - Success toast displayed

#### Debug Mode Flow

12. **User Enables Debug**
   - Click 🐛 (bug icon) button
   - Icon turns blue when active

13. **Toggle Debug**
   ```javascript
   PATCH /api/projects/:id/extensions/:extId/debug
   Body: { debug: true }
   ```
   - Extension metadata updated
   - "Debug" badge shown on card

14. **Logging Begins**
   - Backend starts capturing execution logs
   - Frontend UI components can log using `extensionLogger`
   - Logs stored with timestamp, level, message, source

#### Debug Logs Viewer Flow

15. **User Expands Logs**
   - Clicks "Error" or "Debug" badge
   - `expandedDebugLogs` set adds extension ID

16. **Fetch Logs**
   ```javascript
   GET /api/projects/:id/extensions/:extId/debug
   ```
   - Returns all logs from frontend and backend
   - Logs split by source: `frontend` vs `backend`

17. **Display Logs**
   - Two tabs: Frontend / Backend
   - Each log shows:
     - Timestamp
     - Level (INFO, WARN, ERROR)
     - Source (UI / Worker)
     - Message
     - Optional data (expandable)

18. **Refresh Logs**
   - User clicks "Refresh" button
   - Same GET request repeated
   - Logs updated in place
   - Toast: "Debug logs refreshed"

#### Delete Flow

19. **User Clicks Delete**
   - Only available for custom extensions (not built-in)
   - Confirmation dialog opens

20. **Confirm Delete**
   ```javascript
   DELETE /api/projects/:id/extensions/:extId
   ```
   - Frontend sends delete request
   - Backend removes from database
   - Cache cleared

21. **Reload Data**
   - `loadData()` called again
   - Extension list refreshed
   - Card removed from UI
   - Toast: "Extension deleted"

#### Reset Flow

22. **User Clicks Reset**
   - Button in header (with refresh icon)
   - Warning dialog: "Delete all custom extensions?"

23. **Confirm Reset**
   ```javascript
   POST /api/projects/:id/extensions/reset
   ```
   - Backend deletes all custom extensions
   - Copies default extensions from `backend/src/tools/extensions/defaults/`
   - Resets to factory state

24. **Full Reload**
   - `loadData()` triggered
   - All extensions reloaded
   - Toast: "Extensions reset to defaults"

### Extension Execution Flow (During Chat)

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│     LLM      │      │   Backend    │      │  Extension   │      │   External   │
│  (decides    │      │  (calls      │      │  (executes   │      │   APIs/      │
│   to call)    │      │   extension) │      │   code)      │      │  Services)   │
└──────┬───────┘      └──────┬───────┘      └──────┬───────┘      └──────┬───────┘
       │                      │                      │                      │
       │ 1. Tool call        │                      │                      │
       ├─────────────────────>│                      │                      │
       │   name: "ext_id"    │                      │                      │
       │   params: {...}      │                      │                      │
       │                      │                      │                      │
       │                      │  2. Load extension  │                      │
       │                      ├─────────────────────>│                      │
       │                      │                      │                      │
       │                      │                      │  3. Execute code  │
       │                      │                      ├───────────────────────>│
       │                      │                      │                      │
       │                      │                      │                      │  4. API call/
       │                      │                      │                      │     data fetch
       │                      │                      │                      ├──────────>
       │                      │                      │                      │<──────────
       │                      │                      │                      │
       │                      │                      │  5. Return result │
       │                      │                      │<───────────────────────│
       │                      │                      │                      │
       │                      │  6. Tool response   │                      │
       │                      │<─────────────────────│                      │
       │  7. Result          │                      │                      │
       │<─────────────────────│                      │                      │
```

### Related Pages

| Page | Route | Purpose |
|------|--------|---------|
| Extension Editor | `/projects/:id/extensions/:extensionId` | Edit extension code |
| AI Creator | `/projects/:id/extensions/ai-create` | Create extension with AI |
| Upgrade | `/projects/:id/extensions/upgrade` | Check for updates |

---

## Common UI Patterns

### Header Component

All Developer pages use the standard Header component:

```tsx
<Header>
  <HeaderLeft>
    <HeaderTitle>Page Title</HeaderTitle>
  </HeaderLeft>
  <HeaderRight>
    {/* Optional actions */}
  </HeaderRight>
</Header>
```

### Layout Pattern

All Developer pages follow the standard layout pattern:

```tsx
<div className="flex h-full flex-col">
  <Header>
    <HeaderLeft>
      <HeaderTitle>Page Title</HeaderTitle>
    </HeaderLeft>
  </Header>

  <div className="flex-1 overflow-hidden">
    <div className="h-full px-4 pt-4 md:px-6 pb-4 overflow-y-auto">
      {/* Page content */}
    </div>
  </div>
</div>
```

---

## Routing Configuration

From [app-router.tsx](../frontend/src/components/app-router.tsx):

```tsx
// Developer routes - Admin only
<Route
  path="/projects/:projectId/api"
  element={
    <AdminRoute>
      <ProjectRouteHandler>
        <DeveloperAPIPage />
      </ProjectRouteHandler>
    </AdminRoute>
  }
/>
<Route
  path="/projects/:projectId/embed"
  element={
    <AdminRoute>
      <ProjectRouteHandler>
        <EmbedSettings />
      </ProjectRouteHandler>
    </AdminRoute>
  }
/>
<Route
  path="/projects/:projectId/extensions"
  element={
    <AdminRoute>
      <ProjectRouteHandler>
        <ExtensionsSettings />
      </ProjectRouteHandler>
    </AdminRoute>
  }
/>
```

---

## Sidebar Navigation

From [app-sidebar.tsx](../frontend/src/components/layout/app-sidebar.tsx):

```tsx
{
  title: "Developer",
  url: getUrl("developer"),
  icon: Code,
  items: [
    {
      title: "API",
      url: getUrl("api"),
    },
    {
      title: "Embed",
      url: getUrl("embed"),
    },
    {
      title: "Extensions",
      url: getUrl("extensions"),
    },
  ]
}
```

---

## Related Documentation

- [Extension Capabilities](extensions/capabilities-report.md) - Complete extension capabilities reference
- [Chat Architecture](architecture/chat-architecture.md) - Overall chat system design
- [Frontend Architecture Rules](frontend/architecture-rules.md) - Layer hierarchy and boundaries
