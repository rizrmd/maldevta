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
import { Code, Key, Globe, ExternalLink, Copy, Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

export default function DeveloperPage() {
  const { user } = useAuth();

  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");

  const [copiedKey, setCopiedKey] = useState("");

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
        console.error("Failed to load projects:", err);
      }
    };
    loadProjects();
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(""), 2000);
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <AppLayout
      header={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Developer</BreadcrumbPage>
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
                Developer Resources
              </p>
              <h1 className="font-display text-3xl text-slate-900 md:text-4xl">
                API Documentation
              </h1>
              <p className="text-sm text-muted-foreground">
                Integrate maldevta with your applications
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Project:</span>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm"
              >
                <option value="">Select project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!selectedProjectId ? (
            <div className="w-full rounded-lg border border-slate-200 bg-white/80 p-8 text-center">
              <Code className="mx-auto h-12 w-12 text-slate-400" />
              <p className="mt-4 text-sm text-muted-foreground">
                Select a project to view developer resources
              </p>
            </div>
          ) : (
            <>
              {/* API Base URL */}
              <Card className="border-[#e6dccc] bg-white/80 backdrop-blur">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-slate-600" />
                    <CardTitle>API Base URL</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Base URL for all API requests:
                    </p>
                    <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-4 py-3 font-mono text-sm">
                      <span>https://maldevta.com/api/projects/{selectedProjectId}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(`https://maldevta.com/api/projects/${selectedProjectId}`)}
                      >
                        {copiedKey === `https://maldevta.com/api/projects/${selectedProjectId}` ? (
                          <>
                            <Check className="mr-1 h-3 w-3 text-emerald-600" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="mr-1 h-3 w-3" />
                            {copiedKey ? "Copied!" : "Copy"}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* API Key */}
              <Card className="border-[#e6dccc] bg-white/80 backdrop-blur">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Key className="h-5 w-5 text-slate-600" />
                    <CardTitle>API Authentication</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="api-endpoint">API Endpoint</Label>
                    <Input
                      id="api-endpoint"
                      value={`POST /auth/tenant/login`}
                      readOnly
                      className="bg-slate-50 font-mono text-sm"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="session-cookie">Session Cookie</Label>
                    <Input
                      id="session-cookie"
                      value="Your session cookie (sent automatically)"
                      readOnly
                      className="bg-slate-50 text-sm"
                    />
                  </div>

                  <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                    All API requests use cookie-based authentication. Session cookies are sent automatically with credentials: "include".
                  </div>
                </CardContent>
              </Card>

              {/* Available Endpoints */}
              <Card className="border-[#e6dccc] bg-white/80 backdrop-blur">
                <CardHeader>
                  <CardTitle>Available Endpoints</CardTitle>
                  <CardDescription>
                    API endpoints for project "{selectedProject?.name}"
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { method: "GET", path: `/projects/${selectedProjectId}/conversations`, desc: "List all conversations" },
                      { method: "POST", path: `/projects/${selectedProjectId}/conversations`, desc: "Create new conversation" },
                      { method: "GET", path: `/projects/${selectedProjectId}/conversations/:id`, desc: "Get conversation details" },
                      { method: "POST", path: `/projects/${selectedProjectId}/conversations/:id/messages`, desc: "Send message" },
                      { method: "GET", path: `/projects/${selectedProjectId}/context`, desc: "Get project context" },
                      { method: "PUT", path: `/projects/${selectedProjectId}/context`, desc: "Update project context" },
                    ].map((ep) => (
                      <div key={ep.path} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3">
                        <Badge variant="outline" className="text-xs font-mono mt-0.5">
                          {ep.method}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900">{ep.path}</p>
                          <p className="text-xs text-slate-600">{ep.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Webhook Settings */}
              <Card className="border-[#e6dccc] bg-white/80 backdrop-blur">
                <CardHeader>
                  <CardTitle>Webhooks</CardTitle>
                  <CardDescription>
                    Configure webhooks for real-time notifications
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <p>Webhooks allow external services to receive real-time notifications when events occur in your project.</p>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="webhook-url">Webhook URL</Label>
                    <Input
                      id="webhook-url"
                      placeholder="https://your-app.com/webhook"
                      className="font-mono text-sm"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="webhook-events">Events</Label>
                    <Input
                      id="webhook-events"
                      value="message.sent, conversation.created, user.joined"
                      readOnly
                      className="bg-slate-50 text-sm"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button disabled>
                      Save Webhook
                    </Button>
                    <Button variant="outline" disabled>
                      Test Webhook
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Documentation Link */}
              <Card className="border-[#e6dccc] bg-white/80 backdrop-blur">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ExternalLink className="h-5 w-5 text-slate-600" />
                    Full Documentation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    View complete API documentation, examples, and integration guides.
                  </p>
                  <Button variant="outline" asChild>
                    <a
                      href="https://docs.maldevta.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2"
                    >
                      View Docs
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
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
