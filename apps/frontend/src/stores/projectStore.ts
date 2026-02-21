import { create } from "zustand";

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

export type Project = {
  id: string;
  tenant_id: string;
  name: string;
  whatsapp_enabled: boolean;
  subclient_enabled: boolean;
  sub_clients_enabled?: boolean;
  sub_clients_registration_enabled?: boolean;
  created_by_user_id: string;
  created_at: string;
};

type ListProjectsResponse = {
  projects: Project[];
};

interface ProjectStore {
  // State
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  error: string | null;
  hasInitialized: boolean;

  // Actions
  loadProjects: () => Promise<void>;
  selectProject: (projectId: string) => void;
  clearCurrentProject: () => void;
  createProject: (name: string, enableWhatsapp: boolean, enableSubclients: boolean) => Promise<Project>;
  deleteProject: (projectId: string) => Promise<void>;
  renameProject: (projectId: string, newName: string) => Promise<void>;
  setError: (error: string | null) => void;
  updateProjectSubClientSettings: (projectId: string, settings: { sub_clients_enabled?: boolean; sub_clients_registration_enabled?: boolean }) => Promise<void>;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  // Initial state
  projects: [],
  currentProject: null,
  isLoading: false,
  error: null,
  hasInitialized: false,

  // Actions
  loadProjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiRequest<ListProjectsResponse>("/projects");
      set({
        projects: response.projects || [],
        isLoading: false,
        hasInitialized: true,
      });
    } catch (err) {
      const apiError = err as ApiError;
      set({
        error: apiError.message || "Failed to load projects",
        isLoading: false,
        hasInitialized: true,
      });
    }
  },

  selectProject: (projectId: string) => {
    const { projects } = get();
    const project = projects.find((p) => p.id === projectId);
    if (project) {
      set({ currentProject: project });
    }
  },

  clearCurrentProject: () => set({ currentProject: null }),

  createProject: async (name: string, enableWhatsapp: boolean, enableSubclients: boolean) => {
    set({ isLoading: true, error: null });
    try {
      const project = await apiRequest<Project>("/projects", {
        method: "POST",
        body: JSON.stringify({
          name,
          enable_whatsapp: enableWhatsapp,
          enable_subclients: enableSubclients,
        }),
      });

      set((state) => ({
        projects: [...state.projects, project],
        currentProject: project,
        isLoading: false,
      }));

      return project;
    } catch (err) {
      const apiError = err as ApiError;
      set({ error: apiError.message || "Failed to create project", isLoading: false });
      throw err;
    }
  },

  deleteProject: async (projectId: string) => {
    set({ isLoading: true, error: null });
    try {
      await apiRequest(`/projects/${projectId}`, { method: "DELETE" });

      set((state) => ({
        projects: state.projects.filter((p) => p.id !== projectId),
        currentProject: state.currentProject?.id === projectId ? null : state.currentProject,
        isLoading: false,
      }));
    } catch (err) {
      const apiError = err as ApiError;
      set({ error: apiError.message || "Failed to delete project", isLoading: false });
      throw err;
    }
  },

  renameProject: async (projectId: string, newName: string) => {
    set({ isLoading: true, error: null });
    try {
      await apiRequest(`/projects/${projectId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: newName }),
      });

      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === projectId ? { ...p, name: newName } : p
        ),
        currentProject:
          state.currentProject?.id === projectId
            ? { ...state.currentProject, name: newName }
            : state.currentProject,
        isLoading: false,
      }));
    } catch (err) {
      const apiError = err as ApiError;
      set({ error: apiError.message || "Failed to rename project", isLoading: false });
      throw err;
    }
  },

  setError: (error) => set({ error }),

  updateProjectSubClientSettings: async (projectId: string, settings: { sub_clients_enabled?: boolean; sub_clients_registration_enabled?: boolean }) => {
    set({ isLoading: true, error: null });
    try {
      await apiRequest(`/projects/${projectId}`, {
        method: "PUT",
        body: JSON.stringify(settings),
      });

      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === projectId ? { ...p, ...settings } : p
        ),
        currentProject:
          state.currentProject?.id === projectId
            ? { ...state.currentProject, ...settings }
            : state.currentProject,
        isLoading: false,
      }));
    } catch (err) {
      const apiError = err as ApiError;
      set({ error: apiError.message || "Failed to update settings", isLoading: false });
      throw err;
    }
  },
}));
