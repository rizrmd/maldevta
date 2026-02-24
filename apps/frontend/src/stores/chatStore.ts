import { create } from "zustand";

export type MessageRole = "user" | "assistant" | "system";

export type ToolInvocation = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  status: "pending" | "executing" | "completed" | "error";
  result?: unknown;
  error?: string;
};

export type Message = {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: Date;
  updatedAt?: Date;
  toolInvocations?: ToolInvocation[];
  rating?: "thumbs-up" | "thumbs-down" | null;
  metadata?: Record<string, unknown>;
};

export type Conversation = {
  id: string;
  projectId: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
};

type ApiError = {
  message: string;
  status?: number;
  code?: string;
};

// async function parseError(response: Response): Promise<ApiError> {
//   let payload: unknown = null;
//   try {
//     payload = await response.json();
//   } catch {
//     payload = null;
//   }
//
//   if (payload && typeof payload === "object") {
//     const record = payload as { message?: string; code?: string };
//     return {
//       message: record.message || `${response.status} ${response.statusText}`,
//       status: response.status,
//       code: record.code,
//     };
//   }
//
//   return {
//     message: `${response.status} ${response.statusText}`,
//     status: response.status,
//   };
// }

// async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
//   const response = await fetch(path, {
//     ...init,
//     credentials: "include",
//     headers: {
//       "Content-Type": "application/json",
//       ...(init?.headers || {}),
//     },
//   });
//
//   if (!response.ok) {
//     throw await parseError(response);
//   }
//
//   if (response.status === 204) {
//     return undefined as T;
//   }
//
//   return response.json() as Promise<T>;
// }

interface ChatStore {
  // State
  conversations: Conversation[];
  currentConversation: Conversation | null;
  currentProjectId: string | null;
  input: string;
  isGenerating: boolean;
  isHistoryLoading: boolean;
  error: string | null;
  connectionStatus: "disconnected" | "connecting" | "connected" | "error";

  // UI State
  shouldAutoScroll: boolean;
  isUserScrolling: boolean;

  // Actions
  setCurrentProjectId: (projectId: string | null) => void;
  setInput: (input: string) => void;
  setCurrentConversation: (conversation: Conversation | null) => void;
  setIsGenerating: (isGenerating: boolean) => void;
  setConnectionStatus: (status: "disconnected" | "connecting" | "connected" | "error") => void;
  setShouldAutoScroll: (should: boolean) => void;
  setIsUserScrolling: (isScrolling: boolean) => void;

  // Message actions
  addMessage: (message: Omit<Message, "id" | "createdAt">) => Message;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  rateMessage: (messageId: string, rating: "thumbs-up" | "thumbs-down" | null) => void;
  deleteMessage: (messageId: string) => void;

  // Conversation actions
  loadConversations: (projectId: string) => Promise<void>;
  createConversation: (projectId: string, title?: string) => Promise<Conversation>;
  deleteConversation: (conversationId: string) => Promise<void>;

  // Streaming actions
  streamResponse: (conversationId: string, messages: Message[]) => AsyncGenerator<string, void, unknown>;

  // Utility
  clearError: () => void;
  reset: () => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  // Initial state
  conversations: [],
  currentConversation: null,
  currentProjectId: null,
  input: "",
  isGenerating: false,
  isHistoryLoading: false,
  error: null,
  connectionStatus: "disconnected",
  shouldAutoScroll: true,
  isUserScrolling: false,

  // Actions
  setCurrentProjectId: (projectId) => set({ currentProjectId: projectId }),

  setInput: (input) => set({ input }),

  setCurrentConversation: (conversation) => set({ currentConversation: conversation }),

  setIsGenerating: (isGenerating) => set({ isGenerating }),

  setConnectionStatus: (status) => set({ connectionStatus: status }),

  setShouldAutoScroll: (should) => set({ shouldAutoScroll: should }),

  setIsUserScrolling: (isScrolling) => set({ isUserScrolling: isScrolling }),

  addMessage: (messageData) => {
    const message: Message = {
      ...messageData,
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
    };

    let success = false;

    set((state) => {
      if (!state.currentConversation) {
        console.error("[chatStore] addMessage: no current conversation, message not added", message);
        return state; // Return unchanged state
      }

      success = true;
      console.log("[chatStore] addMessage: adding message to conversation", {
        conversationId: state.currentConversation.id,
        messageCount: state.currentConversation.messages.length,
        newMessageRole: message.role
      });

      const updatedConversation = {
        ...state.currentConversation,
        messages: [...state.currentConversation.messages, message],
        updatedAt: new Date(),
      };

      return {
        currentConversation: updatedConversation,
        conversations: state.conversations.map((c) =>
          c.id === updatedConversation.id ? updatedConversation : c
        ),
      };
    });

    if (!success) {
      console.error("[chatStore] addMessage: failed - no conversation", message);
      // Return null or throw error to indicate failure
      return { ...message, content: "[ERROR] Failed to add message - no conversation" };
    }

    console.log("[chatStore] addMessage: success", { messageId: message.id });
    return message;
  },

  updateMessage: (messageId, updates) => {
    set((state) => {
      if (!state.currentConversation) return state;

      const updatedConversation = {
        ...state.currentConversation,
        messages: state.currentConversation.messages.map((m) =>
          m.id === messageId ? { ...m, ...updates, updatedAt: new Date() } : m
        ),
      };

      return {
        currentConversation: updatedConversation,
        conversations: state.conversations.map((c) =>
          c.id === updatedConversation.id ? updatedConversation : c
        ),
      };
    });
  },

  rateMessage: (messageId, rating) => {
    // Update local state
    get().updateMessage(messageId, { rating });

    // TODO: Send rating to backend
    // apiRequest(`/conversations/${conversationId}/messages/${messageId}/rating`, {
    //   method: "POST",
    //   body: JSON.stringify({ rating }),
    // });
  },

  deleteMessage: (messageId) => {
    set((state) => {
      if (!state.currentConversation) return state;

      const updatedConversation = {
        ...state.currentConversation,
        messages: state.currentConversation.messages.filter((m) => m.id !== messageId),
        updatedAt: new Date(),
      };

      return {
        currentConversation: updatedConversation,
        conversations: state.conversations.map((c) =>
          c.id === updatedConversation.id ? updatedConversation : c
        ),
      };
    });
  },

  loadConversations: async (_projectId) => {
    set({ isHistoryLoading: true, error: null });
    try {
      // TODO: Implement API call
      // const response = await apiRequest<{ conversations: Conversation[] }>(
      //   `/projects/${_projectId}/conversations`
      // );

      // For now, set empty state
      set({
        conversations: [],
        isHistoryLoading: false,
      });
    } catch (err) {
      const apiError = err as ApiError;
      set({ error: apiError.message || "Failed to load conversations", isHistoryLoading: false });
    }
  },

  createConversation: async (projectId, title) => {
    set({ error: null });
    try {
      // TODO: Implement API call
      // const conversation = await apiRequest<Conversation>(`/projects/${projectId}/conversations`, {
      //   method: "POST",
      //   body: JSON.stringify({ title: title || "New Conversation" }),
      // });

      const conversation: Conversation = {
        id: `conv-${Date.now()}`,
        projectId,
        title: title || "New Conversation",
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      set((state) => ({
        conversations: [conversation, ...state.conversations],
        currentConversation: conversation,
      }));

      return conversation;
    } catch (err) {
      const apiError = err as ApiError;
      set({ error: apiError.message || "Failed to create conversation" });
      throw err;
    }
  },

  deleteConversation: async (conversationId) => {
    set({ error: null });
    try {
      // TODO: Implement API call
      // await apiRequest(`/conversations/${conversationId}`, { method: "DELETE" });

      set((state) => ({
        conversations: state.conversations.filter((c) => c.id !== conversationId),
        currentConversation:
          state.currentConversation?.id === conversationId ? null : state.currentConversation,
      }));
    } catch (err) {
      const apiError = err as ApiError;
      set({ error: apiError.message || "Failed to delete conversation" });
      throw err;
    }
  },

  streamResponse: async function* (_conversationId, _messages) {
    set({ isGenerating: true, shouldAutoScroll: true });

    try {
      // TODO: Implement streaming API
      // const response = await fetch(`/conversations/${_conversationId}/stream`, {
      //   method: "POST",
      //   credentials: "include",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ messages: _messages.map(m => ({ role: m.role, content: m.content })) }),
      // });

      // const reader = response.body?.getReader();
      // const decoder = new TextDecoder();

      // if (reader) {
      //   while (true) {
      //     const { done, value } = await reader.read();
      //     if (done) break;
      //     const chunk = decoder.decode(value);
      //     yield chunk;
      //   }
      // }

      // Placeholder yield
      yield "This is a placeholder response. The streaming API is not yet implemented.";
    } catch (err) {
      const apiError = err as ApiError;
      set({ error: apiError.message || "Failed to stream response" });
    } finally {
      set({ isGenerating: false });
    }
  },

  clearError: () => set({ error: null }),

  reset: () =>
    set({
      conversations: [],
      currentConversation: null,
      input: "",
      isGenerating: false,
      error: null,
      connectionStatus: "disconnected",
    }),
}));
