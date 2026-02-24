import { useEffect, useState, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import AppLayout from "@/components/app-layout";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { MessageSquare, Trash2, Search, LayoutGrid } from "lucide-react";
import { Input } from "@/components/ui/input";

type ApiError = {
  message: string;
  status?: number;
  code?: string;
};

// Conversation types
type ConversationResponse = {
  id: string;
  project_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  last_message?: string;
};

type ListConversationsResponse = {
  conversations: ConversationResponse[];
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

export default function HistoryPage() {
  const params = useParams<{ projectId: string }>();
  const [location] = useLocation();
  const [, setLocation] = useLocation();

  const [conversations, setConversations] = useState<ConversationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const selectedProjectId = params.projectId || "";

  // Get project ID from URL (fallback for legacy routes)
  useEffect(() => {
    if (!selectedProjectId) {
      const match = location.match(/\/projects\/([^\/]+)/);
      if (match) {
        // Legacy route - redirect to new route
        const projectId = match[1];
        setLocation(`/projects/${projectId}/history`);
      }
    }
  }, [location, selectedProjectId, setLocation]);

  // Load conversations for selected project
  useEffect(() => {
    if (!selectedProjectId) {
      setConversations([]);
      return;
    }

    const loadConversations = async () => {
      setLoading(true);
      try {
        const response = await apiRequest<ListConversationsResponse>(
          `/projects/${selectedProjectId}/conversations`
        );
        setConversations(response.conversations || []);
      } catch (err) {
        const apiError = err as ApiError;
        setError(apiError.message || "Failed to load conversations");
      } finally {
        setLoading(false);
      }
    };
    loadConversations();
  }, [selectedProjectId]);

  // Filter conversations by search
  const filteredConversations = conversations.filter((conv) =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (conv.last_message && conv.last_message.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Sort conversations by updated_at (newest first)
  const sortedConversations = useMemo(() => {
    return [...filteredConversations].sort((a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  }, [filteredConversations]);

  // Group conversations by date
  const groupedConversations = useMemo(() => {
    const groups: Record<string, typeof sortedConversations> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);

    sortedConversations.forEach((conv) => {
      const convDate = new Date(conv.updated_at);
      convDate.setHours(0, 0, 0, 0);

      let groupKey = "Older";
      if (convDate.getTime() === today.getTime()) {
        groupKey = "Today";
      } else if (convDate.getTime() === yesterday.getTime()) {
        groupKey = "Yesterday";
      } else if (convDate >= thisWeek) {
        groupKey = "This Week";
      } else if (convDate.getMonth() === today.getMonth() && convDate.getFullYear() === today.getFullYear()) {
        groupKey = "This Month";
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(conv);
    });

    return groups;
  }, [sortedConversations]);

  const groupOrder = ["Today", "Yesterday", "This Week", "This Month", "Older"];

  const handleDeleteConversation = async (convId: string) => {
    if (!confirm("Are you sure you want to delete this conversation?")) {
      return;
    }

    try {
      await apiRequest(`/projects/${selectedProjectId}/conversations/${convId}`, {
        method: "DELETE",
      });
      setConversations(conversations.filter((c) => c.id !== convId));
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || "Failed to delete conversation");
    }
  };

  const openConversation = (conversationId?: string) => {
    if (selectedProjectId) {
      if (conversationId) {
        // Navigate to specific conversation
        setLocation(`/projects/${selectedProjectId}/chat/${conversationId}`);
      } else {
        // Navigate to new chat
        setLocation(`/chat/${selectedProjectId}`);
      }
    }
  };

  return (
    <AppLayout
      header={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/" className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4" />
                Projects
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>History</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      }
    >
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
          {/* Header */}
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Chat History
            </h1>
            <p className="text-sm text-muted-foreground">
              View and manage your conversation history
            </p>
          </div>

          {error && (
            <div className="w-full rounded-lg border border-destructive/200 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {!selectedProjectId ? (
            <div className="w-full rounded-lg border border-border bg-card p-8 text-center">
              <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-sm text-muted-foreground">
                {loading ? "Loading projects..." : "No projects available. Create a project first."}
              </p>
            </div>
          ) : (
            <>
              {/* Search Conversations */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search conversations..."
                  className="pl-9"
                />
              </div>

              {/* Conversations List */}
              <div className="space-y-4">
                {/* Header Info */}
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">
                    {filteredConversations.length} conversation{filteredConversations.length !== 1 ? "s" : ""}
                  </h2>
                </div>

                {loading ? (
                  <div className="flex h-48 items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-3 border-slate-200 border-t-slate-600" />
                  </div>
                ) : filteredConversations.length === 0 ? (
                  <div className="py-16 text-center">
                    <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#ffd7a8] to-[#9fe7d4]">
                      <MessageSquare className="h-10 w-10 text-slate-600" />
                    </div>
                    <h3 className="mb-2 text-xl font-semibold text-slate-900 font-display">No conversations found</h3>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      {searchQuery
                        ? "Try adjusting your search terms to find what you're looking for"
                        : "Start a new chat to see your conversation history here"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {groupOrder.map((groupName) => {
                      const groupConversations = groupedConversations[groupName];
                      if (!groupConversations || groupConversations.length === 0) return null;

                      return (
                        <div key={groupName}>
                          {/* Group Header */}
                          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-2">
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              {groupName}
                            </h3>
                          </div>

                          {/* Conversations in this group */}
                          <div className="divide-y divide-border/50">
                            {groupConversations.map((conv) => (
                              <div
                                key={conv.id}
                                className="group relative flex items-center gap-3 py-3 px-2 -mx-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                                onClick={() => openConversation(conv.id)}
                              >
                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-sm font-medium text-foreground truncate">
                                    {conv.title || "Untitled Conversation"}
                                  </h4>

                                  {/* Last message preview */}
                                  {conv.last_message && (
                                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                                      {conv.last_message}
                                    </p>
                                  )}
                                </div>

                                {/* Metadata & Actions */}
                                <div className="flex items-center gap-2 shrink-0">
                                  {/* Message count badge */}
                                  {conv.message_count > 0 && (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <MessageSquare className="h-3 w-3" />
                                      <span>{conv.message_count}</span>
                                    </div>
                                  )}
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(conv.updated_at).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric'
                                    })}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteConversation(conv.id);
                                    }}
                                    className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
    </AppLayout>
  );
}
