import { useEffect, useState } from "react";
import { useLocation } from "wouter";
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
import { MessageSquare, Clock, Trash2, Search, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

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

// Conversation types
type ConversationResponse = {
  id: string;
  project_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
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
  const { user } = useAuth();
  const [location] = useLocation();
  const [, setLocation] = useLocation();

  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [conversations, setConversations] = useState<ConversationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Get project ID from URL
  useEffect(() => {
    const match = location.match(/\/projects\/([^\/]+)/);
    if (match) {
      setSelectedProjectId(match[1]);
    }
  }, [location]);

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
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  const openConversation = (convId: string) => {
    setLocation(`/projects/${selectedProjectId}/chat/${convId}`);
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <AppLayout
      header={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Conversation History</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      }
    >
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                Conversation History
              </p>
              <h1 className="font-display text-3xl text-slate-900 md:text-4xl">
                Chat History
              </h1>
              <p className="text-sm text-muted-foreground">
                View and manage your conversation history
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
            <>
              {/* Search Bar */}
              <Card className="border-[#e6dccc] bg-white/80 backdrop-blur">
                <CardContent className="pt-6">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search conversations..."
                      className="pl-10"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Conversations List */}
              <Card className="border-[#e6dccc] bg-white/80 backdrop-blur">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>All Conversations</CardTitle>
                      <CardDescription>
                        {filteredConversations.length} conversation{filteredConversations.length !== 1 ? "s" : ""}
                      </CardDescription>
                    </div>
                    {selectedProject && (
                      <Badge variant="outline" className="text-xs">
                        {selectedProject.name}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex h-32 items-center justify-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                    </div>
                  ) : filteredConversations.length === 0 ? (
                    <div className="py-12 text-center">
                      <MessageSquare className="mx-auto mb-4 h-12 w-12 text-slate-400" />
                      <h3 className="mb-2 text-lg font-semibold text-slate-900">No conversations found</h3>
                      <p className="text-sm text-muted-foreground">
                        {searchQuery ? "Try a different search term" : "Start chatting to see your conversation history here"}
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {filteredConversations.map((conv) => (
                        <div
                          key={conv.id}
                          className="group flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-4 transition-all hover:shadow-md hover:border-slate-300 cursor-pointer"
                          onClick={() => openConversation(conv.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <MessageSquare className="h-5 w-5 text-slate-600" />
                              <h3 className="truncate font-semibold text-slate-900">
                                {conv.title || "Untitled Conversation"}
                              </h3>
                              <Badge variant="secondary" className="text-xs">
                                {conv.message_count} messages
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                <span>
                                  {new Date(conv.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                <span>
                                  {new Date(conv.updated_at).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-slate-400 transition-colors group-hover:text-slate-600" />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteConversation(conv.id);
                            }}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {user && (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <div className="flex items-center justify-between">
                <span>Signed in as: <span className="font-medium">{user.role}</span></span>
                <span className="font-mono">{user.userId?.slice(0, 8)}...</span>
              </div>
            </div>
          )}
        </div>
    </AppLayout>
  );
}
