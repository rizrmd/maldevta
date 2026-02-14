#!/usr/bin/env curl
# Example API Usage for Data Management System

# Prerequisites:
# 1. Set DATA_DIR environment variable
# 2. Have a valid session cookie from authentication

# Extract your session cookie from login response
SESSION_COOKIE="aicore_session_value_here"
PROJECT_ID="prj_xxxxx"
SUBCLIENT_ID="sub_xxxxx"

# ============================================================================
# PROJECT CONTEXT MANAGEMENT
# ============================================================================

# Get project context
curl -X GET \
  "http://localhost:9400/projects/${PROJECT_ID}/context" \
  -H "Cookie: aicore_session=${SESSION_COOKIE}"

# Update project context
curl -X PUT \
  "http://localhost:9400/projects/${PROJECT_ID}/context" \
  -H "Cookie: aicore_session=${SESSION_COOKIE}" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "# Project Setup\n\nThis is the project documentation.\n"
  }'

# ============================================================================
# PROJECT CONVERSATIONS
# ============================================================================

# Create a new conversation in a project
RESPONSE=$(curl -s -X POST \
  "http://localhost:9400/projects/${PROJECT_ID}/conversations" \
  -H "Cookie: aicore_session=${SESSION_COOKIE}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Project Discussion"
  }')

# Extract conversation ID from response (assumes jq is installed)
CONV_ID=$(echo "$RESPONSE" | jq -r '.id')

# List all conversations in a project
curl -X GET \
  "http://localhost:9400/projects/${PROJECT_ID}/conversations" \
  -H "Cookie: aicore_session=${SESSION_COOKIE}"

# Get a specific conversation
curl -X GET \
  "http://localhost:9400/projects/${PROJECT_ID}/conversations/${CONV_ID}" \
  -H "Cookie: aicore_session=${SESSION_COOKIE}"

# Add a message to a conversation
curl -X POST \
  "http://localhost:9400/projects/${PROJECT_ID}/conversations/${CONV_ID}/messages" \
  -H "Cookie: aicore_session=${SESSION_COOKIE}" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "user",
    "content": "What are the project requirements?"
  }'

# Add an assistant message
curl -X POST \
  "http://localhost:9400/projects/${PROJECT_ID}/conversations/${CONV_ID}/messages" \
  -H "Cookie: aicore_session=${SESSION_COOKIE}" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "assistant",
    "content": "The project requirements are..."
  }'

# ============================================================================
# SUBCLIENT CONVERSATIONS
# ============================================================================

# Create conversation in a subclient
curl -X POST \
  "http://localhost:9400/subclients/${SUBCLIENT_ID}/conversations" \
  -H "Cookie: aicore_session=${SESSION_COOKIE}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Client Discussion"
  }'

# List all conversations for a subclient
curl -X GET \
  "http://localhost:9400/subclients/${SUBCLIENT_ID}/conversations" \
  -H "Cookie: aicore_session=${SESSION_COOKIE}"

# Get a specific subclient conversation
curl -X GET \
  "http://localhost:9400/subclients/${SUBCLIENT_ID}/conversations/${CONV_ID}" \
  -H "Cookie: aicore_session=${SESSION_COOKIE}"

# Add message to subclient conversation
curl -X POST \
  "http://localhost:9400/subclients/${SUBCLIENT_ID}/conversations/${CONV_ID}/messages" \
  -H "Cookie: aicore_session=${SESSION_COOKIE}" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "user",
    "content": "Hey there!"
  }'

# ============================================================================
# EXAMPLE: COMPLETE WORKFLOW
# ============================================================================

#!/bin/bash

# Set variables
DATA_DIR="/tmp/maldevta-data"
SESSION_COOKIE="your_session_here"

# 1. Create a project
echo "Creating project..."
PROJECT_RESPONSE=$(curl -s -X POST "http://localhost:9400/projects" \
  -H "Cookie: aicore_session=${SESSION_COOKIE}" \
  -H "Content-Type: application/json" \
  -d '{"name": "AI Assistant Project"}')
PROJECT_ID=$(echo "$PROJECT_RESPONSE" | jq -r '.id')
echo "Created project: $PROJECT_ID"

# 2. Update project context
echo "Updating project context..."
curl -s -X PUT "http://localhost:9400/projects/${PROJECT_ID}/context" \
  -H "Cookie: aicore_session=${SESSION_COOKIE}" \
  -H "Content-Type: application/json" \
  -d '{"content": "# AI Assistant\n\nBuilding an AI-powered assistant for project management."}'

# 3. Create a conversation
echo "Creating conversation..."
CONV_RESPONSE=$(curl -s -X POST "http://localhost:9400/projects/${PROJECT_ID}/conversations" \
  -H "Cookie: aicore_session=${SESSION_COOKIE}" \
  -H "Content-Type: application/json" \
  -d '{"title": "Initial Setup Discussion"}')
CONV_ID=$(echo "$CONV_RESPONSE" | jq -r '.id')
echo "Created conversation: $CONV_ID"

# 4. Add messages
echo "Adding messages..."
curl -s -X POST "http://localhost:9400/projects/${PROJECT_ID}/conversations/${CONV_ID}/messages" \
  -H "Cookie: aicore_session=${SESSION_COOKIE}" \
  -H "Content-Type: application/json" \
  -d '{"role": "user", "content": "What are our next steps?"}'

curl -s -X POST "http://localhost:9400/projects/${PROJECT_ID}/conversations/${CONV_ID}/messages" \
  -H "Cookie: aicore_session=${SESSION_COOKIE}" \
  -H "Content-Type: application/json" \
  -d '{"role": "assistant", "content": "Let me help you with project planning..."}'

# 5. Retrieve conversation
echo "Retrieved conversation:"
curl -s -X GET "http://localhost:9400/projects/${PROJECT_ID}/conversations/${CONV_ID}" \
  -H "Cookie: aicore_session=${SESSION_COOKIE}" | jq .

echo "Workflow complete!"
echo "Data stored in: $DATA_DIR/tenants/{tenant-id}/projects/${PROJECT_ID}/"
