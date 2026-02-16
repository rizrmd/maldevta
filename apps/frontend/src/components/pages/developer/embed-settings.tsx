import { useCallback, useEffect, useState } from "react";
import { useParams } from "wouter";
import AppLayout from "@/components/app-layout";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Check, Copy, Globe } from "lucide-react";

type ApiError = {
  message: string;
  status?: number;
  code?: string;
};

type ProjectResponse = {
  id: string;
  name: string;
  show_history?: boolean;
  use_client_uid?: boolean;
  allowed_origins?: string[];
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

// Simple toast helper
function showToast(message: string, type: "success" | "error" = "success") {
  const toast = document.createElement("div");
  toast.className = `fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg z-50 ${
    type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
  }`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

export function EmbedSettings() {
  const params = useParams<{ projectId: string }>();
  const projectId = params?.projectId || "";
  const API_BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';

  const [embedToken, setEmbedToken] = useState<string | null>(null);
  const [customCss, setCustomCss] = useState("");
  const [project, setProject] = useState<ProjectResponse | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeType, setCodeType] = useState<"iframe" | "javascript">("iframe");
  const [width, setWidth] = useState("400px");
  const [height, setHeight] = useState("600px");

  // Config state
  const [showHistory, setShowHistory] = useState(false);
  const [userMode, setUserMode] = useState<"current" | "uid">("current");
  const [allowedOrigins, setAllowedOrigins] = useState("");

  // Load embed settings
  const loadEmbedSettings = useCallback(async () => {
    if (!projectId) return;

    setIsLoading(true);
    setError(null);

    try {
      // Load project data
      const projectData = await apiRequest<{ success: boolean; data: ProjectResponse }>(`/projects/${projectId}`);
      if (projectData.success) {
        setProject(projectData.data);
        setEmbedToken(projectData.data.id);
        setShowHistory(projectData.data.show_history ?? false);
        setUserMode(projectData.data.use_client_uid ? "uid" : "current");

        const origins = projectData.data.allowed_origins || [];
        setAllowedOrigins(origins.join("\n"));
      }

      // Load custom CSS
      try {
        const cssData = await apiRequest<{ success: boolean; data: { customCss?: string } }>(`/projects/${projectId}/embed/css`);
        if (cssData.success && cssData.data.customCss) {
          setCustomCss(cssData.data.customCss);
        }
      } catch {
        // CSS endpoint might not exist yet, set empty
        setCustomCss("");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load embed settings";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) {
      loadEmbedSettings();
    }
  }, [projectId, loadEmbedSettings]);

  const handleSaveConfig = async () => {
    if (!projectId) return;

    setIsSaving(true);

    try {
      const configUpdates = {
        show_history: showHistory,
        use_client_uid: userMode === "uid",
        allowed_origins: allowedOrigins.split("\n").map(s => s.trim()).filter(Boolean),
      };

      const response = await apiRequest<{ success: boolean }>(`/projects/${projectId}`, {
        method: "PUT",
        body: JSON.stringify(configUpdates),
      });

      if (response.success) {
        showToast("Configuration saved successfully");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save configuration";
      setError(errorMessage);
      showToast(errorMessage, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveCustomCss = async () => {
    if (!projectId) return;

    setIsSaving(true);

    try {
      await apiRequest(`/projects/${projectId}/embed/css`, {
        method: "POST",
        body: JSON.stringify({ customCss }),
      });

      showToast("Custom CSS saved successfully");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save custom CSS";
      setError(errorMessage);
      showToast(errorMessage, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const generateIframeCode = (): string => {
    if (!projectId || !embedToken) return "";
    const embedUrl = `${window.location.origin}/embed?projectId=${encodeURIComponent(projectId)}&embedToken=${encodeURIComponent(embedToken)}`;

    return `<iframe
  src="${embedUrl}"
  width="${width}"
  height="${height}"
  frameborder="0"
  allow="microphone"
  style="border: 1px solid #ccc; border-radius: 8px;"
></iframe>`;
  };

  const generateJavaScriptCode = (): string => {
    if (!projectId || !embedToken) return "";
    const embedUrl = `${window.location.origin}/embed?projectId=${encodeURIComponent(projectId)}&embedToken=${encodeURIComponent(embedToken)}`;

    return `<div id="maldevta-chat"></div>
<script>
(function() {
  const iframe = document.createElement('iframe');
  iframe.src = '${embedUrl}';
  iframe.width = '${width}';
  iframe.height = '${height}';
  iframe.frameBorder = '0';
  iframe.allow = 'microphone';
  iframe.style.cssText = 'border: 1px solid #ccc; border-radius: 8px;';
  document.getElementById('maldevta-chat').appendChild(iframe);
})();
<\/script>`;
  };

  const embedCode = embedToken
    ? codeType === "iframe"
      ? generateIframeCode()
      : generateJavaScriptCode()
    : "";

  const handleCopyCode = async () => {
    setIsCopying(true);
    try {
      await navigator.clipboard.writeText(embedCode);
      showToast("Embed code copied to clipboard!");
      setTimeout(() => setIsCopying(false), 2000);
    } catch (err) {
      showToast("Failed to copy to clipboard", "error");
      setIsCopying(false);
    }
  };

  if (!projectId) {
    return (
      <AppLayout
        header={
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Embed</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        }
      >
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <Globe className="mx-auto h-12 w-12 text-slate-400" />
            <p className="mt-4 text-sm text-slate-600">No project selected. Please select a project first.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      header={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Embed</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      }
    >
      <div className="flex-1 overflow-hidden">
        <div className="h-full px-4 pt-4 md:px-6 pb-4 overflow-y-auto">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="ml-4 text-sm text-slate-600">Loading embed settings...</p>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto">
              <Tabs defaultValue="config" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="config">Config</TabsTrigger>
                  <TabsTrigger value="css">CSS</TabsTrigger>
                  <TabsTrigger value="code">Code</TabsTrigger>
                </TabsList>

                {/* CONFIG TAB */}
                <TabsContent value="config" className="space-y-6 pt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Display Options</CardTitle>
                      <CardDescription>
                        Configure which features are visible in the embedded chat interface.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="show-history">Conversation History</Label>
                          <p className="text-sm text-slate-600">Show sidebar with conversation list</p>
                        </div>
                        <input
                          id="show-history"
                          type="checkbox"
                          checked={showHistory}
                          onChange={(e) => setShowHistory(e.target.checked)}
                          className="h-4 w-4"
                        />
                      </div>

                      <div className="space-y-2 pt-4 border-t">
                        <Label htmlFor="user-mode">User Identification</Label>
                        <select
                          id="user-mode"
                          value={userMode}
                          onChange={(e) => setUserMode(e.target.value as "current" | "uid")}
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                        >
                          <option value="current">Current User</option>
                          <option value="uid">By UID Param</option>
                        </select>
                        <p className="text-xs text-slate-600">
                          {userMode === "current"
                            ? "All embedded users share the same conversation history"
                            : "Each user has their own history by passing a unique uid parameter"}
                        </p>
                      </div>

                      <div className="space-y-2 pt-4 border-t">
                        <Label htmlFor="allowed-origins">Allowed Domains (CORS)</Label>
                        <p className="text-sm text-slate-600">
                          Enter one domain per line (e.g., https://example.com). Leave empty to allow all.
                        </p>
                        <textarea
                          id="allowed-origins"
                          value={allowedOrigins}
                          onChange={(e) => setAllowedOrigins(e.target.value)}
                          placeholder="https://example.com&#10;https://app.example.com"
                          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm min-h-[100px] resize-y font-mono"
                          spellCheck={false}
                        />
                      </div>

                      <div className="flex justify-end pt-4">
                        <Button onClick={handleSaveConfig} disabled={isSaving}>
                          {isSaving ? "Saving..." : "Save Configuration"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* CSS TAB */}
                <TabsContent value="css" className="space-y-4 pt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Custom CSS</CardTitle>
                      <CardDescription>
                        Add custom CSS to style the embedded chat widget. Max 10KB.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <textarea
                        value={customCss}
                        onChange={(e) => setCustomCss(e.target.value)}
                        placeholder={`/* Example CSS */
.maldevta-chat-container {
  background-color: #f5f5f5;
}
.maldevta-chat-input {
  border-radius: 8px;
}`}
                        maxLength={10240}
                        rows={15}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-y"
                      />
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-600">
                          {customCss.length}/10240
                        </p>
                        <Button onClick={handleSaveCustomCss} disabled={isSaving}>
                          {isSaving ? "Saving..." : "Save CSS"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* CODE TAB */}
                <TabsContent value="code" className="space-y-6 pt-4">
                  {/* Embed Token */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Embed Token</CardTitle>
                      <CardDescription>
                        The embed token is the project ID. This token is used to access your embedded chat.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Input
                        value={embedToken || ""}
                        readOnly
                        className="font-mono text-sm"
                      />
                    </CardContent>
                  </Card>

                  {/* Dimensions */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Widget Size</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="width">Width</Label>
                          <Input
                            id="width"
                            value={width}
                            onChange={(e) => setWidth(e.target.value)}
                            placeholder="400px"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="height">Height</Label>
                          <Input
                            id="height"
                            value={height}
                            onChange={(e) => setHeight(e.target.value)}
                            placeholder="600px"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Code Type */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Embed Code Type</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => setCodeType("iframe")}
                          variant={codeType === "iframe" ? "default" : "outline"}
                          size="sm"
                        >
                          iframe
                        </Button>
                        <Button
                          onClick={() => setCodeType("javascript")}
                          variant={codeType === "javascript" ? "default" : "outline"}
                          size="sm"
                        >
                          JavaScript
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Generated Code */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>Embed Code</CardTitle>
                        <Button
                          onClick={handleCopyCode}
                          variant="outline"
                          size="sm"
                        >
                          {isCopying ? (
                            <>
                              <Check className="mr-2 h-4 w-4" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="mr-2 h-4 w-4" />
                              Copy
                            </>
                          )}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <textarea
                        readOnly
                        value={embedCode}
                        onClick={(e) => e.currentTarget.select()}
                        className="w-full min-h-[180px] rounded-md border border-input bg-muted px-3 py-2 text-xs font-mono resize-y"
                      />
                      <p className="mt-2 text-xs text-slate-600">
                        Click the code to select all, then copy and paste into your website.
                      </p>
                    </CardContent>
                  </Card>

                  {userMode === "uid" && (
                    <div className="rounded-md bg-blue-50 border border-blue-200 p-4">
                      <h4 className="font-semibold text-blue-900 mb-2 text-sm">Using UID Parameter for User History</h4>
                      <p className="text-xs text-blue-800 mb-2">
                        To maintain separate conversation history for each user, add a uid parameter to the embed URL.
                      </p>
                      <pre className="text-xs text-blue-900 bg-blue-100 p-2 rounded overflow-x-auto">
                        {`<iframe
  src="${window.location.origin}/embed?projectId=${projectId}&embedToken=${embedToken}&uid=USER_ID_HERE"
  width="${width}"
  height="${height}"
></iframe>`}
                      </pre>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
