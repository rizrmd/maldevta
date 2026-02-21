import { create } from "zustand";

const API_BASE = window.location.origin;

export interface Tenant {
  id: string;
  name: string;
  domain: string;
  is_default: boolean;
  has_logo: boolean;
  created_at: number;
  updated_at: number;
}

export interface User {
  id: string;
  tenant_id: string;
  username: string;
  email: string;
  role: "admin" | "user";
  source: string;
  created_at: number;
  updated_at: number;
}

interface TenantStore {
  // State
  tenants: Tenant[];
  users: User[];
  isLoading: boolean;
  error: string | null;

  // Actions
  setTenants: (tenants: Tenant[]) => void;
  setUsers: (users: User[]) => void;
  setIsLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;

  // Tenant actions
  fetchTenants: () => Promise<void>;
  createTenant: (name: string, domain: string) => Promise<Tenant | null>;
  updateTenant: (tenantId: string, name: string, domain: string) => Promise<boolean>;
  deleteTenant: (tenantId: string) => Promise<boolean>;

  // User actions
  fetchTenantUsers: (tenantId: string) => Promise<void>;
  createTenantUser: (
    tenantId: string,
    email: string,
    username: string,
    password: string,
    role: "admin" | "user"
  ) => Promise<boolean>;
  updateTenantUser: (
    tenantId: string,
    userId: string,
    data: { email?: string; username?: string; password?: string; role?: "admin" | "user" }
  ) => Promise<boolean>;
  deleteTenantUser: (tenantId: string, userId: string) => Promise<boolean>;
}

export const useTenantStore = create<TenantStore>((set) => ({
  // Initial state
  tenants: [],
  users: [],
  isLoading: false,
  error: null,

  // Synchronous actions
  setTenants: (tenants) => set({ tenants }),
  setUsers: (users) => set({ users }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  // Fetch all tenants
  fetchTenants: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_BASE}/api/system/tenants`, {
        credentials: "include",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch tenants");
      }
      const data = await response.json();
      set({ tenants: data.tenants || [], isLoading: false, error: null });
    } catch (error: any) {
      set({
        error: error.message || "Failed to fetch tenants",
        isLoading: false,
      });
    }
  },

  // Create tenant
  createTenant: async (name: string, domain: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_BASE}/api/system/tenants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, domain }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create tenant");
      }
      const data = await response.json();
      set((state) => ({
        tenants: [...state.tenants, data.tenant],
        isLoading: false,
        error: null,
      }));
      return data.tenant;
    } catch (error: any) {
      set({
        error: error.message || "Failed to create tenant",
        isLoading: false,
      });
      return null;
    }
  },

  // Update tenant
  updateTenant: async (tenantId: string, name: string, domain: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_BASE}/api/system/tenants/${tenantId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, domain }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update tenant");
      }
      const data = await response.json();
      set((state) => ({
        tenants: state.tenants.map((t) =>
          t.id === tenantId ? data.tenant : t
        ),
        isLoading: false,
        error: null,
      }));
      return true;
    } catch (error: any) {
      set({
        error: error.message || "Failed to update tenant",
        isLoading: false,
      });
      return false;
    }
  },

  // Delete tenant
  deleteTenant: async (tenantId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_BASE}/api/system/tenants/${tenantId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete tenant");
      }
      set((state) => ({
        tenants: state.tenants.filter((t) => t.id !== tenantId),
        isLoading: false,
        error: null,
      }));
      return true;
    } catch (error: any) {
      set({
        error: error.message || "Failed to delete tenant",
        isLoading: false,
      });
      return false;
    }
  },

  // Fetch users for a tenant
  fetchTenantUsers: async (tenantId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(
        `${API_BASE}/api/system/tenants/${tenantId}/users`,
        { credentials: "include" }
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch users");
      }
      const data = await response.json();
      set({ users: data.users || [], isLoading: false, error: null });
    } catch (error: any) {
      set({
        error: error.message || "Failed to fetch users",
        isLoading: false,
      });
    }
  },

  // Create user for a tenant
  createTenantUser: async (
    tenantId: string,
    email: string,
    username: string,
    password: string,
    role: "admin" | "user"
  ) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(
        `${API_BASE}/api/system/tenants/${tenantId}/users`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email, username, password, role }),
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create user");
      }
      const data = await response.json();
      set((state) => ({
        users: [...state.users, data.user],
        isLoading: false,
        error: null,
      }));
      return true;
    } catch (error: any) {
      set({
        error: error.message || "Failed to create user",
        isLoading: false,
      });
      return false;
    }
  },

  // Update user in a tenant
  updateTenantUser: async (
    tenantId: string,
    userId: string,
    data: { email?: string; username?: string; password?: string; role?: "admin" | "user" }
  ) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(
        `${API_BASE}/api/system/tenants/${tenantId}/users/${userId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(data),
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update user");
      }
      const responseData = await response.json();
      set((state) => ({
        users: state.users.map((u) =>
          u.id === userId ? responseData.user : u
        ),
        isLoading: false,
        error: null,
      }));
      return true;
    } catch (error: any) {
      set({
        error: error.message || "Failed to update user",
        isLoading: false,
      });
      return false;
    }
  },

  // Delete user from a tenant
  deleteTenantUser: async (tenantId: string, userId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(
        `${API_BASE}/api/system/tenants/${tenantId}/users/${userId}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete user");
      }
      set((state) => ({
        users: state.users.filter((u) => u.id !== userId),
        isLoading: false,
        error: null,
      }));
      return true;
    } catch (error: any) {
      set({
        error: error.message || "Failed to delete user",
        isLoading: false,
      });
      return false;
    }
  },
}));
