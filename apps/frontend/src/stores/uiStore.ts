import { create } from "zustand";

export type ToastType = "success" | "error" | "info" | "warning";

export type Toast = {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
};

export type DialogType =
  | "create-project"
  | "rename-project"
  | "delete-project"
  | "delete-conversation"
  | "script-details"
  | "generic-tool";

interface UIStore {
  // Toast state
  toasts: Toast[];

  // Dialog state
  activeDialog: DialogType | null;
  dialogData: Record<string, unknown> | null;

  // Sidebar state
  sidebarCollapsed: boolean;

  // Chat-specific UI
  textAreaHeight: number;
  showScrollToBottom: boolean;

  // Todo panel state
  todoPanelOpen: boolean;

  // Actions
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (toastId: string) => void;
  clearToasts: () => void;

  openDialog: (dialogType: DialogType, data?: Record<string, unknown>) => void;
  closeDialog: () => void;

  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;

  setTextAreaHeight: (height: number) => void;
  setShowScrollToBottom: (show: boolean) => void;

  setTodoPanelOpen: (open: boolean) => void;
  toggleTodoPanel: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  // Initial state
  toasts: [],
  activeDialog: null,
  dialogData: null,
  sidebarCollapsed: false,
  textAreaHeight: 0,
  showScrollToBottom: false,
  todoPanelOpen: false,

  // Toast actions
  addToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast: Toast = { ...toast, id };

    set((state) => ({ toasts: [...state.toasts, newToast] }));

    // Auto-remove after duration (default 5 seconds)
    const duration = toast.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
      }, duration);
    }
  },

  removeToast: (toastId) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== toastId),
    })),

  clearToasts: () => set({ toasts: [] }),

  // Dialog actions
  openDialog: (dialogType, data) =>
    set({ activeDialog: dialogType, dialogData: data ?? null }),

  closeDialog: () => set({ activeDialog: null, dialogData: null }),

  // Sidebar actions
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  // Chat UI actions
  setTextAreaHeight: (height) => set({ textAreaHeight: height }),

  setShowScrollToBottom: (show) => set({ showScrollToBottom: show }),

  // Todo panel actions
  setTodoPanelOpen: (open) => set({ todoPanelOpen: open }),

  toggleTodoPanel: () => set((state) => ({ todoPanelOpen: !state.todoPanelOpen })),
}));
