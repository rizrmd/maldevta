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
import { Plus, MessageCircle as WhatsAppIcon, Users, ArrowRight, Clock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

type ApiError = {
  message: string;
  status?: number;
  code?: string;
};

type ProjectResponse = {
  id: string;
  tenant_id: string;
  name: string;
  whatsapp_enabled: boolean;
  subclient_enabled: boolean;
  created_by_user_id: string;
  created_at: string;
};

type ListProjectsResponse = {
  projects: ProjectResponse[];
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

export default function ProjectsPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [enableWhatsapp, setEnableWhatsapp] = useState(true);
  const [enableSubclients, setEnableSubclients] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadProjects = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiRequest<ListProjectsResponse>("/projects");
      setProjects(response.projects || []);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || "Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) {
      setError("Project name is required");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const project = await apiRequest<ProjectResponse>("/projects", {
        method: "POST",
        body: JSON.stringify({
          name: newProjectName,
          enable_whatsapp: enableWhatsapp,
          enable_subclients: enableSubclients,
        }),
      });

      setProjects([...projects, project]);
      setNewProjectName("");
      setShowCreateForm(false);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || "Failed to create project");
    } finally {
      setBusy(false);
    }
  };

  const openProject = (projectId: string) => {
    setLocation(`/projects/${projectId}`);
  };

  return (
    <AppLayout
      header={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Projects</BreadcrumbPage>
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
                Projects Management
              </p>
              <h1 className="font-display text-3xl text-slate-900 md:text-4xl">
                Your Projects
              </h1>
              <p className="text-sm text-muted-foreground">
                Create and manage your WhatsApp AI projects
              </p>
            </div>
            <Button onClick={() => setShowCreateForm(!showCreateForm)} size="lg">
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          </div>

          {/* Create Project Form */}
          {showCreateForm && (
            <Card className="border-[#e6dccc] bg-white/80 backdrop-blur">
              <CardHeader>
                <CardTitle>Create New Project</CardTitle>
                <CardDescription>
                  Configure your new WhatsApp AI project
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateProject} className="grid gap-4">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">Project Name</label>
                    <Input
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      placeholder="My WhatsApp Project"
                      disabled={busy}
                      autoFocus
                    />
                  </div>

                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={enableWhatsapp}
                        onChange={(e) => setEnableWhatsapp(e.target.checked)}
                        disabled={busy}
                        className="h-4 w-4 rounded"
                      />
                      Enable WhatsApp
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={enableSubclients}
                        onChange={(e) => setEnableSubclients(e.target.checked)}
                        disabled={busy}
                        className="h-4 w-4 rounded"
                      />
                      Enable Subclients
                    </label>
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit" disabled={busy || !newProjectName.trim()}>
                      {busy ? "Creating..." : "Create Project"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowCreateForm(false)}
                      disabled={busy}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Error Message */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Projects List */}
          <Card className="border-[#e6dccc] bg-white/80 backdrop-blur">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>All Projects</CardTitle>
                  <CardDescription>
                    {projects.length} project{projects.length !== 1 ? "s" : ""} in your tenant
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={loadProjects} disabled={loading}>
                  <Clock className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex h-32 items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                </div>
              ) : projects.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                    <Plus className="h-8 w-8 text-slate-400" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-slate-900">No projects yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Create your first project to get started with WhatsApp AI.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {projects.map((project) => (
                    <Card
                      key={project.id}
                      className="group cursor-pointer border-slate-200 bg-white transition-all hover:shadow-md hover:border-slate-300"
                      onClick={() => openProject(project.id)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="truncate text-lg">{project.name}</CardTitle>
                            <CardDescription className="flex items-center gap-1 text-xs">
                              <Clock className="h-3 w-3" />
                              {new Date(project.created_at).toLocaleDateString()}
                            </CardDescription>
                          </div>
                          <ArrowRight className="h-5 w-5 text-slate-400 transition-colors group-hover:text-slate-600" />
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {/* Features */}
                        <div className="flex flex-wrap gap-2">
                          {project.whatsapp_enabled && (
                            <Badge variant="outline" className="text-xs">
                              <WhatsAppIcon className="mr-1 h-3 w-3" />
                              WhatsApp
                            </Badge>
                          )}
                          {project.subclient_enabled && (
                            <Badge variant="outline" className="text-xs">
                              <Users className="mr-1 h-3 w-3" />
                              Subclients
                            </Badge>
                          )}
                          {!project.whatsapp_enabled && !project.subclient_enabled && (
                            <Badge variant="secondary" className="text-xs">
                              Basic
                            </Badge>
                          )}
                        </div>

                        {/* Project ID */}
                        <div className="rounded-md bg-slate-50 px-2 py-1 text-xs font-mono text-slate-600">
                          ID: {project.id.slice(0, 8)}...
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* User Info Footer */}
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
