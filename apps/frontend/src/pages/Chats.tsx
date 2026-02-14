import { useEffect, useState } from "react";
import AppLayout from "@/components/app-layout";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MessageSquare, Phone, Clock, User, Send } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ApiError = {
  message: string;
  status?: number;
  code?: string;
};

type ProjectResponse = {
  id: string;
  name: string;
  whatsapp_enabled: boolean;
};

type ListProjectsResponse = {
  projects: ProjectResponse[];
};

// Chat message types
type ChatMessage = {
  id: string;
  from_me: boolean;
  text: string;
  timestamp: string;
  sender_name?: string;
};

// Chat conversation types
type ChatConversation = {
  jid: string;
  name: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
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

export default function ChatsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);

  // Load projects
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const response = await apiRequest<ListProjectsResponse>("/projects");
        const projectList = response.projects || [];
        setProjects(projectList);
        if (projectList.length > 0 && !selectedProjectId) {
          setSelectedProjectId(projectList[0].id);
        }
      } catch (err) {
        const apiError = err as ApiError;
        setError(apiError.message || "Failed to load projects");
      } finally {
        setLoading(false);
      }
    };
    loadProjects();
  }, []);

  // Load conversations for selected project
  useEffect(() => {
    if (!selectedProjectId) {
      setConversations([]);
      return;
    }

    // TODO: Implement API call to get conversations
    // For now, show placeholder data
    setConversations([
      {
        jid: "6281234567890@s.whatsapp.net",
        name: "John Doe",
        last_message: "Hello, how are you?",
        last_message_time: new Date().toISOString(),
        unread_count: 2,
      },
      {
        jid: "6289876543210@s.whatsapp.net",
        name: "Jane Smith",
        last_message: "See you later!",
        last_message_time: new Date(Date.now() - 3600000).toISOString(),
        unread_count: 0,
      },
    ]);
  }, [selectedProjectId]);

  // Load messages for selected conversation
  useEffect(() => {
    if (!selectedConversation) {
      setMessages([]);
      return;
    }

    // TODO: Implement API call to get messages
    setMessages([
      {
        id: "1",
        from_me: false,
        text: selectedConversation.last_message,
        timestamp: selectedConversation.last_message_time,
        sender_name: selectedConversation.name,
      },
    ]);
  }, [selectedConversation]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedProjectId || !selectedConversation) {
      return;
    }

    setSending(true);
    try {
      await apiRequest(`/projects/${selectedProjectId}/wa/send`, {
        method: "POST",
        body: JSON.stringify({
          to: selectedConversation.jid,
          message: newMessage,
        }),
      });

      // Add message to local state
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        from_me: true,
        text: newMessage,
        timestamp: new Date().toISOString(),
      };
      setMessages([...messages, userMessage]);
      setNewMessage("");
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <AppLayout
      header={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Chats</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      }
    >
      <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden rounded-2xl border bg-gradient-to-br from-[#f7f2ea] via-white to-[#e6f7f1] p-6">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.9),_rgba(255,255,255,0))]" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#ffd7a8]/60 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-16 h-72 w-72 rounded-full bg-[#9fe7d4]/70 blur-3xl" />

        <div className="mx-auto flex w-full max-w-6xl gap-6">
          {/* Header */}
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                Chat Conversations
              </p>
              <h1 className="font-display text-3xl text-slate-900 md:text-4xl">
                WhatsApp Chats
              </h1>
              <p className="text-sm text-muted-foreground">
                View and manage WhatsApp conversations
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Project:</span>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && (
            <div className="w-full rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {!selectedProjectId ? (
            <div className="w-full rounded-lg border border-slate-200 bg-white/80 p-8 text-center">
              <MessageSquare className="mx-auto h-12 w-12 text-slate-400" />
              <p className="mt-4 text-sm text-muted-foreground">
                {loading ? "Loading projects..." : "No projects available. Create a project first."}
              </p>
            </div>
          ) : (
            <div className="grid w-full gap-6 lg:grid-cols-[300px_1fr]">
              {/* Conversations List */}
              <Card className="border-[#e6dccc] bg-white/80 backdrop-blur">
                <CardHeader>
                  <CardTitle className="text-lg">Conversations</CardTitle>
                  <CardDescription>
                    {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[600px] overflow-y-auto">
                    {conversations.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        No conversations yet
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {conversations.map((conv) => (
                          <button
                            key={conv.jid}
                            onClick={() => setSelectedConversation(conv)}
                            className={`w-full p-4 text-left transition-colors hover:bg-slate-50 ${
                              selectedConversation?.jid === conv.jid ? "bg-slate-100" : ""
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="truncate font-medium text-slate-900">
                                    {conv.name}
                                  </span>
                                  {conv.unread_count > 0 && (
                                    <Badge variant="default" className="text-xs">
                                      {conv.unread_count}
                                    </Badge>
                                  )}
                                </div>
                                <p className="mt-1 truncate text-sm text-slate-600">
                                  {conv.last_message}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <Clock className="h-3 w-3 text-slate-400" />
                                <span className="text-xs text-slate-500">
                                  {new Date(conv.last_message_time).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Chat Messages */}
              <Card className="border-[#e6dccc] bg-white/80 backdrop-blur">
                <CardHeader>
                  {selectedConversation ? (
                    <>
                      <div className="flex items-center gap-2">
                        <User className="h-5 w-5 text-slate-600" />
                        <CardTitle className="text-lg">{selectedConversation.name}</CardTitle>
                      </div>
                      <CardDescription>
                        <Phone className="mr-1 inline h-3 w-3" />
                        {selectedConversation.jid.replace(/@.*/, "")}
                      </CardDescription>
                    </>
                  ) : (
                    <>
                      <CardTitle className="text-lg">Messages</CardTitle>
                      <CardDescription>Select a conversation to view messages</CardDescription>
                    </>
                  )}
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {selectedConversation ? (
                    <>
                      {/* Messages List */}
                      <div className="max-h-[400px] overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4">
                        {messages.length === 0 ? (
                          <div className="text-center text-sm text-muted-foreground">
                            No messages yet
                          </div>
                        ) : (
                          <div className="flex flex-col gap-3">
                            {messages.map((msg) => (
                              <div
                                key={msg.id}
                                className={`flex ${msg.from_me ? "justify-end" : "justify-start"}`}
                              >
                                <div
                                  className={`max-w-[70%] rounded-lg px-3 py-2 ${
                                    msg.from_me
                                      ? "bg-emerald-100 text-emerald-900"
                                      : "bg-white text-slate-900 border border-slate-200"
                                  }`}
                                >
                                  {!msg.from_me && msg.sender_name && (
                                    <p className="mb-1 text-xs font-medium text-slate-600">
                                      {msg.sender_name}
                                    </p>
                                  )}
                                  <p className="text-sm">{msg.text}</p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    {new Date(msg.timestamp).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Message Input */}
                      <div className="flex gap-2">
                        <Input
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder="Type a message..."
                          disabled={sending}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage();
                            }
                          }}
                          className="flex-1"
                        />
                        <Button onClick={handleSendMessage} disabled={sending || !newMessage.trim()}>
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="flex h-64 items-center justify-center text-center text-sm text-muted-foreground">
                      <MessageSquare className="mr-2 h-8 w-8" />
                      Select a conversation to view messages
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
