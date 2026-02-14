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
import { Textarea } from "@/components/ui/textarea";
import { Settings as SettingsIcon, User, Building, Key, Save, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const [activeTab, setActiveTab] = useState("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // General Settings (placeholder - not available in backend)
  const [tenantName, setTenantName] = useState("");
  const [tenantDomain, setTenantDomain] = useState("");

  // Profile Settings
  const [username, setUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Set active tab based on URL
  useEffect(() => {
    if (location.includes("profile")) {
      setActiveTab("profile");
    } else if (location.includes("projects")) {
      setActiveTab("projects");
    } else {
      setActiveTab("general");
    }
  }, [location]);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        // TODO: Implement API calls for settings
        // For now, use placeholder data
        setTenantName("My Tenant");
        setTenantDomain("example.com");
        setUsername(user?.userId || "");
        setLoading(false);
      } catch (err) {
        const apiError = err as ApiError;
        setError(apiError.message || "Failed to load settings");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user]);

  const handleSaveProfileSettings = async () => {
    if (newPassword && newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSaving(true);
    setError("");

    try {
      // TODO: Implement API call
      // await apiRequest("/user/settings", {
      //   method: "PATCH",
      //   body: JSON.stringify({ username, new_password: newPassword }),
      // });

      setSuccess("Profile settings saved successfully");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout
      header={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Settings</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      }
    >
      <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden rounded-2xl border bg-gradient-to-br from-[#f7f2ea] via-white to-[#e6f7f1] p-6">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.9),_rgba(255,255,255,0))]" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#ffd7a8]/60 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-16 h-72 w-72 rounded-full bg-[#9fe7d4]/70 blur-3xl" />

        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                Configuration
              </p>
              <h1 className="font-display text-3xl text-slate-900 md:text-4xl">
                Settings
              </h1>
              <p className="text-sm text-muted-foreground">
                Manage your account and application preferences
              </p>
            </div>
            {user && (
              <Button variant="outline" onClick={logout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {success}
            </div>
          )}

          {/* Settings Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">
                <Building className="mr-2 h-4 w-4" />
                General
              </TabsTrigger>
              <TabsTrigger value="profile">
                <User className="mr-2 h-4 w-4" />
                Profile
              </TabsTrigger>
              <TabsTrigger value="about">
                <Key className="mr-2 h-4 w-4" />
                About
              </TabsTrigger>
            </TabsList>

            {/* General Settings */}
            <TabsContent value="general" className="space-y-4">
              <Card className="border-[#e6dccc] bg-white/80 backdrop-blur">
                <CardHeader>
                  <CardTitle>Tenant Information</CardTitle>
                  <CardDescription>
                    Your tenant-wide settings and information
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="tenant-name">Tenant Name</Label>
                    <Input
                      id="tenant-name"
                      value={tenantName}
                      onChange={(e) => setTenantName(e.target.value)}
                      placeholder="My Organization"
                      disabled
                    />
                    <p className="text-xs text-muted-foreground">
                      Contact administrator to change tenant name
                    </p>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="tenant-domain">Domain</Label>
                    <Input
                      id="tenant-domain"
                      value={tenantDomain}
                      onChange={(e) => setTenantDomain(e.target.value)}
                      placeholder="example.com"
                      disabled
                    />
                    <p className="text-xs text-muted-foreground">
                      Contact administrator to change domain
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-4">
                    <Badge variant="outline" className="text-sm">
                      WhatsApp: Enabled
                    </Badge>
                    <Badge variant="outline" className="text-sm">
                      Subclients: Enabled
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Profile Settings */}
            <TabsContent value="profile" className="space-y-4">
              <Card className="border-[#e6dccc] bg-white/80 backdrop-blur">
                <CardHeader>
                  <CardTitle>Profile Settings</CardTitle>
                  <CardDescription>
                    Manage your account settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="username">User ID</Label>
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="username"
                      disabled
                      className="bg-slate-50"
                    />
                    <p className="text-xs text-muted-foreground">
                      User ID cannot be changed
                    </p>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="role">Role</Label>
                    <Input
                      id="role"
                      value={user?.role || ""}
                      disabled
                      className="bg-slate-50"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Leave empty to keep current password"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                    />
                  </div>

                  <Button onClick={handleSaveProfileSettings} disabled={saving}>
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? "Saving..." : "Save Profile"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* About Tab */}
            <TabsContent value="about" className="space-y-4">
              <Card className="border-[#e6dccc] bg-white/80 backdrop-blur">
                <CardHeader>
                  <CardTitle>About Maldevta</CardTitle>
                  <CardDescription>
                    Platform information and version
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <span className="text-sm font-medium text-slate-900">Version</span>
                    <span className="text-sm text-slate-600">1.0.0</span>
                  </div>
                  <div className="grid gap-2">
                    <span className="text-sm font-medium text-slate-900">License</span>
                    <Badge variant="outline" className="text-xs">
                      {user?.role === "admin" ? "Enterprise" : "Standard"}
                    </Badge>
                  </div>
                  <div className="grid gap-2">
                    <span className="text-sm font-medium text-slate-900">User ID</span>
                    <span className="text-sm font-mono text-slate-600">{user?.userId || "N/A"}</span>
                  </div>
                  <div className="grid gap-2">
                    <span className="text-sm font-medium text-slate-900">Role</span>
                    <span className="text-sm text-slate-600">{user?.role || "N/A"}</span>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* User Info Footer */}
          {user && (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <div className="flex items-center justify-between">
                <span>Signed in as: <span className="font-medium">{user.role}</span></span>
                <span>User ID: <span className="font-mono">{user.userId?.slice(0, 8)}...</span></span>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
