import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import AppLayout from "@/components/app-layout";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Save, FileText, Settings2, Clock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Label } from "@/components/ui/label";
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

type ContextResponse = {
  content: string;
  updated_at: string;
  tone?: string;
  language?: string;
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

export default function ContextPage() {
  const { user } = useAuth();
  const [location] = useLocation();

  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [context, setContext] = useState("");
  const [tone, setTone] = useState("professional");
  const [language, setLanguage] = useState("english");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

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

  // Load context for selected project
  useEffect(() => {
    if (!selectedProjectId) {
      setContext("");
      return;
    }

    const loadContext = async () => {
      setLoading(true);
      try {
        const response = await apiRequest<ContextResponse>(
          `/projects/${selectedProjectId}/context`
        );
        setContext(response.content || "");
        setTone(response.tone || "professional");
        setLanguage(response.language || "english");
        setLastUpdated(response.updated_at || "");
      } catch (err) {
        const apiError = err as ApiError;
        setError(apiError.message || "Failed to load context");
      } finally {
        setLoading(false);
      }
    };
    loadContext();
  }, [selectedProjectId]);

  const handleSaveContext = async () => {
    if (!context.trim()) {
      setError("Context content cannot be empty");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await apiRequest(`/projects/${selectedProjectId}/context`, {
        method: "PUT",
        body: JSON.stringify({
          content: context,
          tone,
          language,
        }),
      });

      setLastUpdated(new Date().toISOString());
      setSuccess("Context saved successfully");
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || "Failed to save context");
    } finally {
      setSaving(false);
    }
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <AppLayout
      header={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Workspace / Context</BreadcrumbPage>
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
                Project Workspace
              </p>
              <h1 className="font-display text-3xl text-slate-900 md:text-4xl">
                Context Editor
              </h1>
              <p className="text-sm text-muted-foreground">
                Define how your AI assistant should behave
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

          {success && (
            <div className="w-full rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {success}
            </div>
          )}

          {!selectedProjectId ? (
            <div className="w-full rounded-lg border border-slate-200 bg-white/80 p-8 text-center">
              <FileText className="mx-auto h-12 w-12 text-slate-400" />
              <p className="mt-4 text-sm text-muted-foreground">
                {loading ? "Loading projects..." : "No projects available. Create a project first."}
              </p>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
              {/* Context Editor */}
              <Card className="border-[#e6dccc] bg-white/80 backdrop-blur">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>System Instructions</CardTitle>
                      <CardDescription>
                        {selectedProject ? (
                          <>For <span className="font-medium">{selectedProject.name}</span></>
                        ) : (
                          "Define AI behavior"
                        )}
                      </CardDescription>
                    </div>
                    {lastUpdated && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>Last updated: {new Date(lastUpdated).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="context">System Prompt / Context</Label>
                    <Textarea
                      id="context"
                      value={context}
                      onChange={(e) => setContext(e.target.value)}
                      placeholder="You are a helpful AI assistant for this project. Your responses should be friendly and professional..."
                      rows={12}
                      disabled={loading}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      This context will be used to guide the AI's behavior in all conversations for this project.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="tone">Response Tone</Label>
                      <Select value={tone} onValueChange={setTone}>
                        <SelectTrigger id="tone">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="professional">Professional</SelectItem>
                          <SelectItem value="casual">Casual</SelectItem>
                          <SelectItem value="friendly">Friendly</SelectItem>
                          <SelectItem value="formal">Formal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="language">Language</Label>
                      <Select value={language} onValueChange={setLanguage}>
                        <SelectTrigger id="language">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="english">English</SelectItem>
                          <SelectItem value="indonesian">Indonesian</SelectItem>
                          <SelectItem value="spanish">Spanish</SelectItem>
                          <SelectItem value="french">French</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handleSaveContext} disabled={saving || loading}>
                      <Save className="mr-2 h-4 w-4" />
                      {saving ? "Saving..." : "Save Context"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Tips Card */}
              <Card className="border-[#e6dccc] bg-white/80 backdrop-blur">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings2 className="h-5 w-5" />
                    Tips for Better Context
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-900">Be Specific</p>
                    <p className="text-muted-foreground">
                      Clearly define the AI's role, expertise, and limitations for this project.
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Set Behavior Guidelines</p>
                    <p className="text-muted-foreground">
                      Include instructions about tone, formatting preferences, and what to avoid.
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Define Project Scope</p>
                    <p className="text-muted-foreground">
                      Specify what the AI should help with and what's outside its scope for this project.
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Use Examples</p>
                    <p className="text-muted-foreground">
                      Provide example responses or scenarios to guide the AI's behavior.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
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
