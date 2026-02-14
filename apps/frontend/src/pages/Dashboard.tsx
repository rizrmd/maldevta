import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
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
import { useAuth } from "@/hooks/useAuth";

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

type StatusResponse = {
  connected: boolean;
  logged_in: boolean;
  project_id: string;
  last_qr: string;
  last_qr_at: string;
  llm_ready: boolean;
  llm_error: string;
  last_error: string;
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

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [projectName, setProjectName] = useState("WhatsApp Link");
  const [projectID, setProjectID] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [qrImage, setQrImage] = useState("");
  const [qrUpdatedAt, setQrUpdatedAt] = useState("");
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uiStatus, setUiStatus] = useState("Idle");
  const [error, setError] = useState("");
  const [polling, setPolling] = useState(false);

  const statusTone = useMemo(() => {
    if (connected) {
      return "bg-emerald-100 text-emerald-900 border-emerald-200";
    }
    if (qrCode) {
      return "bg-amber-100 text-amber-900 border-amber-200";
    }
    if (busy) {
      return "bg-slate-200 text-slate-900 border-slate-300";
    }
    return "bg-slate-100 text-slate-700 border-slate-200";
  }, [connected, qrCode, busy]);

  const statusLabel = useMemo(() => {
    if (connected) {
      return "Connected";
    }
    if (qrCode) {
      return "QR Ready";
    }
    if (busy) {
      return "Working";
    }
    return "Idle";
  }, [connected, qrCode, busy]);

  useEffect(() => {
    let cancelled = false;

    if (!qrCode) {
      setQrImage("");
      return undefined;
    }

    QRCode.toDataURL(qrCode, {
      margin: 1,
      width: 260,
      color: {
        dark: "#0b0b0b",
        light: "#ffffff",
      },
    })
      .then((url: string) => {
        if (!cancelled) {
          setQrImage(url);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Failed to render QR code.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [qrCode]);

  useEffect(() => {
    if (!polling || !projectID) {
      return undefined;
    }

    let cancelled = false;
    let timeoutId: number | undefined;

    const poll = async () => {
      try {
        const response = await apiRequest<{
          code: string;
          updated_at: string;
          connected: boolean;
        }>(
          `/projects/${projectID}/wa/qr`,
        );
        if (cancelled) {
          return;
        }
        setQrCode(response.code || "");
        setQrUpdatedAt(response.updated_at || "");
        setConnected(Boolean(response.connected));

        if (response.connected && !response.code) {
          setUiStatus("WhatsApp connected.");
          setPolling(false);
          return;
        }
      } catch (err) {
        if (!cancelled) {
          const apiError = err as ApiError;
          setError(apiError.message || "Failed to fetch QR code.");
        }
      }

      if (!cancelled) {
        timeoutId = window.setTimeout(poll, 2000) as unknown as number;
      }
    };

    poll();

    return () => {
      cancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [polling, projectID]);

  const handleCreateProject = async () => {
    if (!projectName.trim()) {
      setError("Project name is required");
      return;
    }

    setBusy(true);
    setError("");
    setUiStatus("Creating project...");

    try {
      const project = await apiRequest<ProjectResponse>("/projects", {
        method: "POST",
        body: JSON.stringify({
          name: projectName,
          enable_whatsapp: true,
          enable_subclients: false,
        }),
      });

      setProjectID(project.id);
      setUiStatus(`Project ready: ${project.name}`);

      await apiRequest(`/projects/${project.id}/wa/start`, {
        method: "POST",
      });
      setUiStatus("Waiting for QR code...");
      setPolling(true);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || "Failed to create project");
      setUiStatus("Idle");
    } finally {
      setBusy(false);
    }
  };

  const handleListProjects = async () => {
    try {
      const response = await apiRequest<ListProjectsResponse>("/projects", {
        method: "GET",
      });

      if (response.projects && response.projects.length > 0) {
        const project = response.projects[0];
        setProjectID(project.id);
        setProjectName(project.name);
        setUiStatus(`Project ready: ${project.name}`);
      }
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || "Failed to list projects");
    }
  };

  return (
    <AppLayout
      header={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Dashboard</BreadcrumbPage>
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                WhatsApp Session
              </p>
              <h1 className="font-display text-3xl text-slate-900 md:text-4xl">
                Link a device in seconds
              </h1>
              <p className="text-sm text-muted-foreground">
                Create a project and scan QR code from WhatsApp.
              </p>
            </div>
            <Badge variant="outline" className={statusTone}>
              {statusLabel}
            </Badge>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <Card className="border-[#e6dccc] bg-white/80 backdrop-blur">
              <CardHeader>
                <CardTitle>Manage Projects</CardTitle>
                <CardDescription>
                  Create a new project or use existing one.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <Button
                    onClick={handleListProjects}
                    disabled={busy}
                    variant="outline"
                    className="w-full"
                  >
                    Load Existing
                  </Button>
                  <label className="grid gap-2 text-sm text-slate-700">
                    Project name
                    <Input
                      value={projectName}
                      onChange={(event) => setProjectName(event.target.value)}
                      placeholder="My WhatsApp Project"
                      disabled={busy}
                    />
                  </label>
                </div>

                <Button onClick={handleCreateProject} disabled={busy || !projectName.trim()}>
                  {busy ? "Creating..." : "Create Project"}
                </Button>

                {projectID ? (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 px-3 py-2 text-xs text-slate-600">
                    Project ID: <span className="font-medium">{projectID}</span>
                  </div>
                ) : null}

                {error ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {error}
                  </div>
                ) : null}

                {user && (
                  <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <div className="flex items-center justify-between">
                      <span>Signed in as: <span className="font-medium">{user.role}</span></span>
                      <button
                        onClick={logout}
                        className="text-red-600 hover:text-red-700 underline"
                      >
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-[#e6dccc] bg-white/90 backdrop-blur">
              <CardHeader>
                <CardTitle>Scan QR</CardTitle>
                <CardDescription>
                  On your phone: WhatsApp → Linked devices → Link a device.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                <div className="flex h-64 w-64 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white">
                  {qrImage ? (
                    <img
                      src={qrImage}
                      alt="WhatsApp QR code"
                      className="h-56 w-56"
                    />
                  ) : (
                    <div className="text-center text-sm text-muted-foreground">
                      QR code will appear here once session starts.
                    </div>
                  )}
                </div>
                <div className="text-center text-xs text-muted-foreground">
                  {qrUpdatedAt
                    ? `Updated: ${new Date(qrUpdatedAt).toLocaleString()}`
                    : "Waiting for QR session"}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  Session stays active while this page is open.
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
