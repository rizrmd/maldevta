import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import AppLayout from "./components/app-layout";

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

type ApiError = {
  message: string;
  status?: number;
  code?: string;
};

type AuthResponse = {
  user_id: string;
  role: string;
  scope_type: string;
  scope_id: string;
};

type ProjectResponse = {
  id: string;
  name: string;
  whatsapp_enabled: boolean;
};

type ListProjectsResponse = {
  projects: ProjectResponse[];
};

type QRResponse = {
  code: string;
  updated_at: string;
  connected: boolean;
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

function App() {
  const [licenseKey, setLicenseKey] = useState("");
  const [tenantName, setTenantName] = useState("Local Tenant");
  const [tenantDomain, setTenantDomain] = useState("*");
  const [adminUsername, setAdminUsername] = useState("admin");
  const [adminPassword, setAdminPassword] = useState("admin1234");
  const [projectName, setProjectName] = useState("WhatsApp Link");
  const [projectID, setProjectID] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [qrImage, setQrImage] = useState("");
  const [qrUpdatedAt, setQrUpdatedAt] = useState("");
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Idle");
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
        const response = await apiRequest<QRResponse>(
          `/projects/${projectID}/wa/qr`,
        );
        if (cancelled) {
          return;
        }
        setQrCode(response.code || "");
        setQrUpdatedAt(response.updated_at || "");
        setConnected(Boolean(response.connected));

        if (response.connected && !response.code) {
          setStatus("WhatsApp connected.");
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
        timeoutId = window.setTimeout(poll, 2000);
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

  const handleBootstrap = async () => {
    setBusy(true);
    setError("");
    setStatus("Preparing tenant and project...");
    setConnected(false);

    try {
      if (licenseKey.trim()) {
        const installPayload = {
          license_key: licenseKey,
          tenant_name: tenantName,
          tenant_domain: tenantDomain,
          admin_username: adminUsername,
          admin_password: adminPassword,
        };

        try {
          await apiRequest<AuthResponse>("/auth/install", {
            method: "POST",
            body: JSON.stringify(installPayload),
          });
          setStatus("Installed and signed in.");
        } catch (err) {
          const apiError = err as ApiError;
          if (
            apiError.code === "failed_precondition" ||
            apiError.message.toLowerCase().includes("already installed")
          ) {
            await apiRequest<AuthResponse>("/auth/tenant/login", {
              method: "POST",
              body: JSON.stringify({
                username: adminUsername,
                password: adminPassword,
              }),
            });
            setStatus("Signed in with existing tenant.");
          } else {
            throw err;
          }
        }
      } else {
        await apiRequest<AuthResponse>("/auth/tenant/login", {
          method: "POST",
          body: JSON.stringify({
            username: adminUsername,
            password: adminPassword,
          }),
        });
        setStatus("Signed in with existing tenant.");
      }

      let project: ProjectResponse | null = null;
      try {
        project = await apiRequest<ProjectResponse>("/projects", {
          method: "POST",
          body: JSON.stringify({
            name: projectName,
            enable_whatsapp: true,
            enable_subclients: false,
          }),
        });
      } catch {
        const fallback = await apiRequest<ListProjectsResponse>("/projects", {
          method: "GET",
        });
        project = fallback.projects?.[0] ?? null;
      }

      if (!project) {
        throw new Error("No projects available. Create one and try again.");
      }

      setProjectID(project.id);
      setStatus(`Project ready: ${project.name}`);

      await apiRequest(`/projects/${project.id}/wa/start`, {
        method: "POST",
      });
      setStatus("Waiting for QR code...");
      setPolling(true);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || "Bootstrap failed.");
      setStatus("Idle");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppLayout
      header={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>WhatsApp Link</BreadcrumbPage>
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
                Create a tenant, spin up a project, and scan the QR code from
                WhatsApp.
              </p>
            </div>
            <Badge variant="outline" className={statusTone}>
              {statusLabel}
            </Badge>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <Card className="border-[#e6dccc] bg-white/80 backdrop-blur">
              <CardHeader>
                <CardTitle>Bootstrap & connect</CardTitle>
                <CardDescription>
                  Use a license key once, then log in with the admin
                  credentials.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-2 text-sm text-slate-700">
                    License key
                    <Input
                      value={licenseKey}
                      onChange={(event) => setLicenseKey(event.target.value)}
                      placeholder="xxxx-xxxx-xxxx"
                    />
                  </label>
                  <label className="grid gap-2 text-sm text-slate-700">
                    Tenant name
                    <Input
                      value={tenantName}
                      onChange={(event) => setTenantName(event.target.value)}
                    />
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-2 text-sm text-slate-700">
                    Tenant domain
                    <Input
                      value={tenantDomain}
                      onChange={(event) =>
                        setTenantDomain(event.target.value)
                      }
                      placeholder="*"
                    />
                  </label>
                  <label className="grid gap-2 text-sm text-slate-700">
                    Project name
                    <Input
                      value={projectName}
                      onChange={(event) => setProjectName(event.target.value)}
                    />
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-2 text-sm text-slate-700">
                    Admin username
                    <Input
                      value={adminUsername}
                      onChange={(event) =>
                        setAdminUsername(event.target.value)
                      }
                    />
                  </label>
                  <label className="grid gap-2 text-sm text-slate-700">
                    Admin password
                    <Input
                      type="password"
                      value={adminPassword}
                      onChange={(event) =>
                        setAdminPassword(event.target.value)
                      }
                    />
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={handleBootstrap} disabled={busy}>
                    {busy ? "Working..." : "Create & fetch QR"}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {status}
                  </span>
                </div>
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
                      QR code will appear here once the session starts.
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

export default App;
