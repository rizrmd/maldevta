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
import { Input } from "@/components/ui/input";
import { Database, Plus, Trash2, Search, Clock } from "lucide-react";
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

type MemoryItem = {
  key: string;
  value: string;
  created_at: string;
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

export default function MemoryPage() {
  const { user } = useAuth();
  const [location] = useLocation();

  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [busy, setBusy] = useState(false);

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
        setError((err as { message?: string })?.message || "Failed to load projects");
      }
    };
    loadProjects();
  }, []);

  // Load memories for selected project
  useEffect(() => {
    if (!selectedProjectId) {
      setMemories([]);
      return;
    }

    // TODO: Implement API call to get memories
    // For now, show placeholder data
    setMemories([
      {
        key: "user_name",
        value: "John Doe",
        created_at: new Date().toISOString(),
      },
      {
        key: "user_preference",
        value: "Prefers formal responses",
        created_at: new Date(Date.now() - 86400000).toISOString(),
      },
    ]);
    setLoading(false);
  }, [selectedProjectId]);

  // Filter memories by search
  const filteredMemories = memories.filter((mem) =>
    mem.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
    mem.value.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim() || !newValue.trim()) {
      setError("Key and value are required");
      return;
    }

    setBusy(true);
    setError("");

    try {
      // TODO: Implement API call
      // await apiRequest(`/projects/${selectedProjectId}/memory`, {
      //   method: "POST",
      //   body: JSON.stringify({ key: newKey, value: newValue }),
      // });

      const newMemory: MemoryItem = {
        key: newKey,
        value: newValue,
        created_at: new Date().toISOString(),
      };
      setMemories([...memories, newMemory]);
      setNewKey("");
      setNewValue("");
      setShowAddForm(false);
    } catch (err) {
      setError((err as { message?: string })?.message || "Failed to add memory");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteMemory = async (key: string) => {
    if (!confirm("Are you sure you want to delete this memory?")) {
      return;
    }

    try {
      // TODO: Implement API call
      // await apiRequest(`/projects/${selectedProjectId}/memory/${key}`, {
      //   method: "DELETE",
      // });

      setMemories(memories.filter((m) => m.key !== key));
    } catch (err) {
      setError((err as { message?: string })?.message || "Failed to delete memory");
    }
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <AppLayout
      header={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Memory</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      }
    >
      <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden rounded-2xl border bg-gradient-to-br from-[#f7f2ea] via-white to-[#e6f7f1] p-6">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.9),_rgba(255,255,255,0))]" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#ffd7a8]/60 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-16 h-72 w-72 rounded-full bg-[#9fe7d4]/70 blur-3xl" />

        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                Key-Value Storage
              </p>
              <h1 className="font-display text-3xl text-slate-900 md:text-4xl">
                Memory Store
              </h1>
              <p className="text-sm text-muted-foreground">
                Store and manage key-value pairs for your AI assistant
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={() => setShowAddForm(!showAddForm)} size="lg">
                <Plus className="mr-2 h-4 w-4" />
                Add Memory
              </Button>
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

          {/* Add Memory Form */}
          {showAddForm && (
            <Card className="border-[#e6dccc] bg-white/80 backdrop-blur">
              <CardHeader>
                <CardTitle>Add New Memory</CardTitle>
                <CardDescription>
                  Store information that AI should remember
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddMemory} className="grid gap-4">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">Key</label>
                    <Input
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value)}
                      placeholder="e.g., user_name, preference"
                      disabled={busy}
                    />
                  </div>

                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">Value</label>
                    <Input
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      placeholder="The value to remember"
                      disabled={busy}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit" disabled={busy || !newKey.trim() || !newValue.trim()}>
                      {busy ? "Adding..." : "Add Memory"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowAddForm(false)}
                      disabled={busy}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {!selectedProjectId ? (
            <div className="w-full rounded-lg border border-slate-200 bg-white/80 p-8 text-center">
              <Database className="mx-auto h-12 w-12 text-slate-400" />
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
                      placeholder="Search memories..."
                      className="pl-10"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Memories List */}
              <Card className="border-[#e6dccc] bg-white/80 backdrop-blur">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>All Memories</CardTitle>
                      <CardDescription>
                        {filteredMemories.length} item{filteredMemories.length !== 1 ? "s" : ""}
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
                  ) : filteredMemories.length === 0 ? (
                    <div className="py-12 text-center">
                      <Database className="mx-auto mb-4 h-12 w-12 text-slate-400" />
                      <h3 className="mb-2 text-lg font-semibold text-slate-900">No memories found</h3>
                      <p className="text-sm text-muted-foreground">
                        {searchQuery ? "Try a different search term" : "Add key-value pairs to help AI remember important information"}
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {filteredMemories.map((mem) => (
                        <div
                          key={mem.key}
                          className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 transition-all hover:shadow-md hover:border-slate-300"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Database className="h-5 w-5 text-slate-600" />
                              <div>
                                <h3 className="font-semibold text-slate-900">{mem.key}</h3>
                                <p className="text-sm text-slate-600">{mem.value}</p>
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                <span>{new Date(mem.created_at).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteMemory(mem.key)}
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
      </div>
    </AppLayout>
  );
}
