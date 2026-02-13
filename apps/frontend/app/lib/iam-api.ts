export type SessionStatus = {
  user_id: string;
  role: "admin" | "user";
  scope_type: "tenant" | "subclient";
  tenant_id: string;
  project_id: string;
  subclient_id: string;
};

export type Project = {
  id: string;
  tenant_id: string;
  name: string;
  whatsapp_enabled: boolean;
  subclient_enabled: boolean;
  created_by_user_id: string;
  created_at: string;
};

export type Subclient = {
  id: string;
  project_id: string;
  name: string;
  domain: string;
};

type ApiError = {
  code?: string;
  message?: string;
};

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const err = (await response.json()) as ApiError;
      if (err?.message) {
        message = err.message;
      }
    } catch {
      // ignore non-json errors
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function installLicense(payload: {
  license_key: string;
  tenant_name?: string;
  tenant_domain?: string;
  admin_username?: string;
  admin_password?: string;
}) {
  return apiFetch("/auth/install", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function tenantLogin(payload: { username: string; password: string }) {
  return apiFetch("/auth/tenant/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function subclientLogin(payload: { username: string; password: string }) {
  return apiFetch("/auth/subclient/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getSessionStatus() {
  return apiFetch<SessionStatus>("/auth/session");
}

export async function logout() {
  return apiFetch<{ ok: boolean }>("/auth/logout", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function listProjects() {
  return apiFetch<Project[]>("/projects");
}

export async function createProject(payload: {
  name: string;
  enable_whatsapp: boolean;
  enable_subclients: boolean;
}) {
  return apiFetch<Project>("/projects", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listSubclients(projectId: string) {
  const params = new URLSearchParams({ project_id: projectId });
  return apiFetch<Subclient[]>(`/subclients?${params.toString()}`);
}

export async function createSubclient(payload: {
  project_id: string;
  name: string;
  domain: string;
  admin_username: string;
  admin_password: string;
}) {
  return apiFetch<Subclient>("/subclients", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}