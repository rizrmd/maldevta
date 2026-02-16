import { createContext, useContext, useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import type { AuthData } from "@/stores/authStore";

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
  // Use Zustand store state
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);
  const checking = useAuthStore((state) => state.checking);
  const error = useAuthStore((state) => state.error);
  
  // Get actions
  const checkSessionStore = useAuthStore((state) => state.checkSession);
  const loginStore = useAuthStore((state) => state.login);
  const logoutStore = useAuthStore((state) => state.logout);
  const clearErrorStore = useAuthStore((state) => state.clearError);

  // Check session on mount
  useEffect(() => {
    checkSessionStore();
  }, [checkSessionStore]);

  const value: AuthValue = {
    user,
    loading,
    checking,
    error,
    checkSession: checkSessionStore,
    login: loginStore,
    logout: logoutStore,
    clearError: clearErrorStore,
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
