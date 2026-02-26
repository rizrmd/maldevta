import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Building2, AlertCircle, Send, LogOut, MessageSquare } from "lucide-react";

// Types
type ApiError = {
  message: string;
  status?: number;
  code?: string;
};

type SubClientInfo = {
  id: string;
  name: string;
  description: string | null;
  short_id: string;
  pathname: string;
  registration_enabled: boolean;
  suspended?: boolean;
};

async function parseError(response: Response): Promise<ApiError> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    return {
      message: `${response.status} ${response.statusText}`,
      status: response.status,
    };
  }

  if (payload && typeof payload === "object") {
    const record = payload as { message?: string; code?: string; error?: string };
    return {
      message: record.error || record.message || `${response.status} ${response.statusText}`,
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

export default function SubClientChatPage() {
  const { shortPath } = useParams<{ shortPath: string }>();
  const [, setLocation] = useLocation();
  const { user, logout, checkSession } = useAuthStore();

  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [subClientInfo, setSubClientInfo] = useState<SubClientInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isSuspended, setIsSuspended] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Array<{ id: string; role: string; content: string }>>([]);

  // Check session and fetch sub-client info on mount
  useEffect(() => {
    const initialize = async () => {
      // Check if user is authenticated
      await checkSession();

      if (!shortPath) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const response = await apiRequest<{
          success: boolean;
          data: { subClient: SubClientInfo };
        }>(`/api/sub-clients/lookup?shortPath=${encodeURIComponent(shortPath)}`);

        if (response.success && response.data?.subClient) {
          const info = response.data.subClient;

          if (info.suspended) {
            setIsSuspended(true);
          } else {
            setSubClientInfo(info);
            // Load conversation history
            await loadConversation();
          }
        } else {
          setNotFound(true);
        }
      } catch (err) {
        console.error("Error initializing:", err);
        // If unauthorized, redirect to login
        if (err instanceof Error && err.message.includes("401")) {
          setLocation(`/s/${shortPath}/login`, { replace: true });
        } else {
          setNotFound(true);
        }
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, [shortPath, checkSession, setLocation]);

  const loadConversation = async () => {
    try {
      const response = await apiRequest<{
        success: boolean;
        data: { messages: Array<{ id: string; role: string; content: string }> };
      }>(`/api/sub-client/chat/messages?shortPath=${encodeURIComponent(shortPath)}`);

      if (response.success && response.data?.messages) {
        setMessages(response.data.messages);
      }
    } catch (err) {
      console.error("Error loading conversation:", err);
      // Don't show error, just start with empty conversation
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || isSending) return;

    const userMessage = message.trim();
    setMessage("");
    setIsSending(true);

    // Add user message to UI immediately
    const newUserMessage: { id: string; role: string; content: string } = {
      id: Date.now().toString(),
      role: "user",
      content: userMessage,
    };
    setMessages((prev) => [...prev, newUserMessage]);

    try {
      const response = await apiRequest<{
        success: boolean;
        data: {
          message: { id: string; role: string; content: string };
        };
      }>("/api/sub-client/chat/send", {
        method: "POST",
        body: JSON.stringify({
          shortPath,
          message: userMessage,
        }),
      });

      if (response.success && response.data?.message) {
        setMessages((prev) => [...prev, response.data.message]);
      }
    } catch (err) {
      const apiError = err as ApiError;
      console.error("Error sending message:", apiError);
      // Remove the user message if failed
      setMessages((prev) => prev.filter((m) => m.id !== newUserMessage.id));
      // Show error in a system message
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "system",
          content: `Error: ${apiError.message || "Failed to send message"}`,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleLogout = async () => {
    await logout();
    setLocation(`/s/${shortPath}/login`, { replace: true });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <Card className="w-full max-w-md border-slate-200 bg-white/80 backdrop-blur">
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading workspace...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not found state
  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <Card className="w-full max-w-md border-slate-200 bg-white/80 backdrop-blur">
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-4 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground" />
              <h2 className="text-xl font-semibold">Workspace Not Found</h2>
              <p className="text-sm text-muted-foreground">
                The workspace you're looking for doesn't exist or may have been removed.
              </p>
              <Button
                variant="outline"
                onClick={() => setLocation(`/s/${shortPath}/login`, { replace: true })}
              >
                Back to Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Suspended state
  if (isSuspended) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <Card className="w-full max-w-md border-amber-200 bg-amber-50/80 backdrop-blur">
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-4 text-center">
              <AlertCircle className="h-12 w-12 text-amber-600" />
              <h2 className="text-xl font-semibold text-amber-900">Workspace Suspended</h2>
              <p className="text-sm text-amber-700">
                This workspace has been temporarily suspended. Please contact the administrator for more information.
              </p>
              <Button
                variant="outline"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-5 w-5 text-slate-600" />
          <div>
            <h1 className="font-semibold text-slate-900">{subClientInfo?.name}</h1>
            {user && (
              <p className="text-xs text-slate-500">Signed in as {user.username}</p>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="text-slate-600"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <MessageSquare className="h-12 w-12 text-slate-400 mb-4" />
              <h3 className="text-lg font-medium text-slate-900">Start a conversation</h3>
              <p className="text-sm text-slate-500 max-w-md">
                Send a message to start chatting with the AI assistant in this workspace.
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-emerald-100 text-emerald-900 rounded-br-sm"
                      : msg.role === "system"
                      ? "bg-red-50 text-red-700 border border-red-200"
                      : "bg-white text-slate-900 border border-slate-200 rounded-bl-sm"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words text-sm">{msg.content}</p>
                </div>
              </div>
            ))
          )}
          {isSending && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-4 py-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  <p className="text-sm text-slate-500">AI is thinking...</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-slate-200 bg-white p-4">
        <div className="mx-auto max-w-3xl">
          <div className="flex gap-2">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              disabled={isSending}
              rows={1}
              className="resize-none"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!message.trim() || isSending}
              size="icon"
              className="h-10 w-10 shrink-0"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Press Enter to send, Shift + Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}
