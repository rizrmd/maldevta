import { useEffect, useState } from "react";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Save, FileText, LayoutGrid, Eye, Code } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ApiError = {
  message: string;
  status?: number;
  code?: string;
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
  const params = useParams<{ projectId: string }>();
  const [location] = useLocation();
  const [, setLocation] = useLocation();

  const [baseContext, setBaseContext] = useState("");
  const [compactionContext, setCompactionContext] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const [activeTab, setActiveTab] = useState("base");
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showVariablesModal, setShowVariablesModal] = useState(false);

  const selectedProjectId = params.projectId || "";

  // Get project ID from URL (fallback for legacy routes)
  useEffect(() => {
    if (!selectedProjectId) {
      const match = location.match(/\/settings\/context\/([^\/]+)/);
      if (match) {
        // Already on new route, no redirect needed
        return;
      }
      // Check legacy route
      const legacyMatch = location.match(/\/projects\/([^\/]+)/);
      if (legacyMatch) {
        const projectId = legacyMatch[1];
        setLocation(`/settings/context/${projectId}`);
      }
    }
  }, [location, selectedProjectId, setLocation]);

  // Load context for selected project
  useEffect(() => {
    if (!selectedProjectId) {
      setBaseContext("");
      setCompactionContext("");
      return;
    }

    const loadContext = async () => {
      setLoading(true);
      try {
        const response = await apiRequest<ContextResponse>(
          `/projects/${selectedProjectId}/context`
        );
        setBaseContext(response.content || "");
        setCompactionContext("");
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
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await apiRequest(`/projects/${selectedProjectId}/context`, {
        method: "PUT",
        body: JSON.stringify({
          content: activeTab === "base" ? baseContext : compactionContext,
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
              <BreadcrumbPage>Context</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      }
    >
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
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
            <div className="w-full rounded-lg border border-slate-200 bg-white p-12 text-center">
              <FileText className="mx-auto h-16 w-16 text-slate-300" />
              <p className="mt-4 text-sm text-muted-foreground">
                {loading ? "Loading projects..." : "No projects available. Create a project first."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Tab Navigation with Save and Preview Buttons */}
              <div className="flex items-center justify-between">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="base">Base Context</TabsTrigger>
                    <TabsTrigger value="compaction">Compaction Context</TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setShowPreviewModal(true)}
                    disabled={loading}
                    variant="outline"
                    className="min-w-[100px]"
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Preview
                  </Button>
                  <Button
                    onClick={() => setShowVariablesModal(true)}
                    disabled={loading}
                    variant="outline"
                    className="min-w-[100px]"
                  >
                    <Code className="mr-2 h-4 w-4" />
                    Variables
                  </Button>
                  <Button
                    onClick={handleSaveContext}
                    disabled={saving || loading}
                    className="min-w-[100px]"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>

              {/* Tab Content */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsContent value="base" className="mt-0 space-y-4">
                  <Card className="border border-slate-200">
                    <CardHeader className="border-b border-slate-100">
                      <CardTitle className="text-base">Base Context</CardTitle>
                      <CardDescription className="text-xs">
                        Define the fundamental system prompt and behavior guidelines
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <Textarea
                        value={baseContext}
                        onChange={(e) => setBaseContext(e.target.value)}
                        placeholder="You are a helpful AI assistant for this project. Your responses should be friendly and professional..."
                        rows={8}
                        disabled={loading}
                        className="resize-none font-mono text-sm leading-relaxed"
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="compaction" className="mt-0 space-y-4">
                  <Card className="border border-slate-200">
                    <CardHeader className="border-b border-slate-100">
                      <CardTitle className="text-base">Compaction Context</CardTitle>
                      <CardDescription className="text-xs">
                        Define context for condensed/summarized interactions
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <Textarea
                        value={compactionContext}
                        onChange={(e) => setCompactionContext(e.target.value)}
                        placeholder="Define how the AI should handle context compaction and summarization..."
                        rows={8}
                        disabled={loading}
                        className="resize-none font-mono text-sm leading-relaxed"
                      />
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              {/* Last Updated Info */}
              {lastUpdated && (
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">
                    Last updated: {new Date(lastUpdated).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Preview Modal */}
        <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Context Preview
              </DialogTitle>
              <DialogDescription>
                Preview of your {activeTab === 'base' ? 'base' : 'compaction'} context
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4">
              <div className="rounded-lg bg-slate-50 border border-slate-100 p-4 max-h-[400px] overflow-y-auto">
                <pre className="text-sm font-mono text-slate-700 whitespace-pre-wrap break-words">
                  {activeTab === 'base'
                    ? (baseContext || "No base context defined yet...")
                    : (compactionContext || "No compaction context defined yet...")}
                </pre>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Variables Modal */}
        <Dialog open={showVariablesModal} onOpenChange={setShowVariablesModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                Available Variables
              </DialogTitle>
              <DialogDescription>
                Variables you can use in your context
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-3">
              {activeTab === 'base' ? (
                <>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                    <code className="text-sm font-mono bg-white px-3 py-1.5 rounded border border-slate-200 text-slate-700">
                      {"{{project_name}}"}
                    </code>
                    <span className="text-sm text-muted-foreground">Project name</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                    <code className="text-sm font-mono bg-white px-3 py-1.5 rounded border border-slate-200 text-slate-700">
                      {"{{user_role}}"}
                    </code>
                    <span className="text-sm text-muted-foreground">User role</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                    <code className="text-sm font-mono bg-white px-3 py-1.5 rounded border border-slate-200 text-slate-700">
                      {"{{date}}"}
                    </code>
                    <span className="text-sm text-muted-foreground">Current date</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                    <code className="text-sm font-mono bg-white px-3 py-1.5 rounded border border-slate-200 text-slate-700">
                      {"{{summary_length}}"}
                    </code>
                    <span className="text-sm text-muted-foreground">Summary length</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                    <code className="text-sm font-mono bg-white px-3 py-1.5 rounded border border-slate-200 text-slate-700">
                      {"{{key_points}}"}
                    </code>
                    <span className="text-sm text-muted-foreground">Key points</span>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
    </AppLayout>
  );
}
