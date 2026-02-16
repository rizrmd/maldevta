import { create } from "zustand";
import { persist } from "zustand/middleware";

type ApiError = {
  message: string;
  status?: number;
  code?: string;
};

async function parseError(response: Response): Promise<ApiError> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (payload && typeof payload === "object") {
    const record = payload as { message?: string; code?: string };
    return {
      message: record.message || `${response.status} ${response.statusText}`,
      status: response.status,
      code: record.code,
    };
  }

  return {
    message: `${response.status} ${response.statusText}`,
    status: response.status,
  };
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export type SessionStatus = {
  user_id: string;
  role: string;
  scope_type: string;
  tenant_id?: string;
  project_id?: string;
  subclient_id?: string;
};

export type AuthData = {
  userId: string;
  role: string;
  scopeType: string;
  tenantId?: string;
  projectId?: string;
  subclientId?: string;
};

interface AuthStore {
  // State
  user: AuthData | null;
  loading: boolean;
  checking: boolean;
  error: string | null;

  // Actions
  checkSession: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  setUser: (user: AuthData | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      // Initial state
      user: null,
      loading: true,
      checking: false,
      error: null,

      // Actions
      checkSession: async () => {
        set({ checking: true, error: null });
        try {
          const response = await apiRequest<SessionStatus>("/auth/session");
          set({
            user: {
              userId: response.user_id,
              role: response.role,
              scopeType: response.scope_type,
              tenantId: response.tenant_id,
              projectId: response.project_id,
              subclientId: response.subclient_id,
            },
            checking: false,
          });
        } catch {
          set({ user: null, checking: false });
        }
      },

      login: async (username: string, password: string) => {
        set({ error: null, loading: true });
        try {
          const response = await apiRequest<{
            user_id: string;
            role: string;
            scope_type: string;
            scope_id: string;
          }>("/auth/tenant/login", {
            method: "POST",
            body: JSON.stringify({ username, password }),
          });

          set({
            user: {
              userId: response.user_id,
              role: response.role,
              scopeType: response.scope_type,
              tenantId: response.scope_type === "tenant" ? response.scope_id : undefined,
            },
            loading: false,
          });
        } catch (err) {
          const apiError = err as ApiError;
          set({ error: apiError.message || "Login failed", loading: false });
          throw err;
        }
      },

      logout: async () => {
        set({ error: null, loading: true });
        try {
          await apiRequest("/auth/logout", { method: "POST" });
        } catch {
          // Ignore logout errors
        } finally {
          set({ user: null, loading: false });
        }
      },

      clearError: () => set({ error: null }),

      setUser: (user) => set({ user }),
      setLoading: (loading) => set({ loading }),
    }),
    {
      name: "maldevta-auth",
      partialize: (state) => ({ user: state.user }),
    }
  )
);
