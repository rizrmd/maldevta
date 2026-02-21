-- Migration 6: add managed LLM endpoints and tenant allocations

CREATE TABLE IF NOT EXISTS llm_endpoints (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL DEFAULT 'openai-compatible',
  base_url TEXT,
  api_key TEXT NOT NULL,
  model TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_llm_endpoints_active ON llm_endpoints(is_active);

CREATE TABLE IF NOT EXISTS tenant_llm_allocations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  endpoint_id TEXT NOT NULL REFERENCES llm_endpoints(id) ON DELETE CASCADE,
  allocation_percent REAL NOT NULL CHECK (allocation_percent >= 0 AND allocation_percent <= 100),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, endpoint_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_llm_allocations_tenant_id ON tenant_llm_allocations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_llm_allocations_endpoint_id ON tenant_llm_allocations(endpoint_id);
