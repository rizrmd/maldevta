import { createContext, useCallback, useContext, useEffect, useState } from "react";

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

type AuthValue = {
  user: AuthData | null;
  loading: boolean;
  checking: boolean;
  error: string | null;
  checkSession: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
};

const AuthContext = createContext<AuthValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkSession = useCallback(async () => {
    setChecking(true);
    setError(null);

    try {
      const response = await apiRequest<{ user_id: string; role: string; scope_type: string; tenant_id?: string; project_id?: string; subclient_id?: string }>(
        "/auth/session",
      );

      setUser({
        userId: response.user_id,
        role: response.role,
        scopeType: response.scope_type,
        tenantId: response.tenant_id,
        projectId: response.project_id,
        subclientId: response.subclient_id,
      });
    } catch (err) {
      // Silently fail - user not authenticated
      setUser(null);
    } finally {
      setChecking(false);
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setError(null);
    setLoading(true);

    try {
      const response = await apiRequest<{ user_id: string; role: string; scope_type: string; scope_id: string }>(
        "/auth/tenant/login",
        {
          method: "POST",
          body: JSON.stringify({ username, password }),
        },
      );

      setUser({
        userId: response.user_id,
        role: response.role,
        scopeType: response.scope_type,
        tenantId: response.scope_type === "tenant" ? response.scope_id : undefined,
      });

      setLoading(false);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || "Login failed");
      setLoading(false);
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    setError(null);
    setLoading(true);

    try {
      await apiRequest("/auth/logout", {
        method: "POST",
      });
    } catch {
      // Ignore logout errors
    } finally {
      setUser(null);
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Check session on mount
  useEffect(() => {
    let mounted = true;

    const initialCheck = async () => {
      try {
        const response = await apiRequest<{ user_id: string; role: string; scope_type: string; tenant_id?: string; project_id?: string; subclient_id?: string }>(
          "/auth/session",
        );

        if (mounted) {
          setUser({
            userId: response.user_id,
            role: response.role,
            scopeType: response.scope_type,
            tenantId: response.tenant_id,
            projectId: response.project_id,
            subclientId: response.subclient_id,
          });
        }
      } catch {
        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initialCheck();

    return () => {
      mounted = false;
    };
  }, []);

  const value: AuthValue = {
    user,
    loading,
    checking,
    error,
    checkSession,
    login,
    logout,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
