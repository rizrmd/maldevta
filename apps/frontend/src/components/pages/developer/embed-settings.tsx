import { useCallback, useEffect, useState } from "react";
import { useParams } from "wouter";
import AppLayout from "@/components/app-layout";
import { useProjectStore } from "@/stores";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Copy, Globe, Code2, LayoutGrid } from "lucide-react";

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
  const { currentProject, projects, selectProject, loadProjects, hasInitialized } = useProjectStore();

  const [embedToken, setEmbedToken] = useState<string | null>(null);
  const [customCss, setCustomCss] = useState("");
  const [project, setProject] = useState<ProjectResponse | null>(null);

  // Load projects and sync with URL
  useEffect(() => {
    const init = async () => {
      if (!hasInitialized) {
        await loadProjects();
      }
    };

    init();

    // Sync project with URL only if different - get fresh state from store
    if (projectId) {
      const storeCurrentProject = useProjectStore.getState().currentProject;
      if (storeCurrentProject?.id !== projectId) {
        const matchedProject = projects.find(p => p.id === projectId);
        if (matchedProject) {
          selectProject(projectId);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, projects, hasInitialized]); // currentProject accessed from getState() to prevent dependency cycle

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
    } catch {
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
                <BreadcrumbLink href="/" className="flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4" />
                  Projects
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
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
              <BreadcrumbLink href="/" className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4" />
                Projects
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Embed</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      }
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 py-6">
        {/* Error Alert */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="ml-4 text-sm text-slate-600 dark:text-slate-400">Loading embed settings...</p>
          </div>
        ) : (
          <div className="w-full">
            <Tabs defaultValue="config" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="config">Config</TabsTrigger>
                <TabsTrigger value="css">CSS</TabsTrigger>
                <TabsTrigger value="code">Code</TabsTrigger>
              </TabsList>

              {/* CONFIG TAB */}
              <TabsContent value="config" className="space-y-6 pt-4">
                {/* Header */}
                <div className="flex items-center gap-3 pb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Globe className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Display Options</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Configure which features are visible in the embedded chat interface
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between py-2">
                    <div className="space-y-0.5">
                      <Label htmlFor="show-history" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Conversation History
                      </Label>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Show sidebar with conversation list</p>
                    </div>
                    <input
                      id="show-history"
                      type="checkbox"
                      checked={showHistory}
                      onChange={(e) => setShowHistory(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                    <Label htmlFor="user-mode" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      User Identification
                    </Label>
                    <select
                      id="user-mode"
                      value={userMode}
                      onChange={(e) => setUserMode(e.target.value as "current" | "uid")}
                      className="flex h-10 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                    >
                      <option value="current">Current User</option>
                      <option value="uid">By UID Param</option>
                    </select>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {userMode === "current"
                        ? "All embedded users share the same conversation history"
                        : "Each user has their own history by passing a unique uid parameter"}
                    </p>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                    <Label htmlFor="allowed-origins" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Allowed Domains (CORS)
                    </Label>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Enter one domain per line (e.g., https://example.com). Leave empty to allow all.
                    </p>
                    <textarea
                      id="allowed-origins"
                      value={allowedOrigins}
                      onChange={(e) => setAllowedOrigins(e.target.value)}
                      placeholder="https://example.com&#10;https://app.example.com"
                      className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm shadow-sm min-h-[120px] resize-y font-mono"
                      spellCheck={false}
                    />
                  </div>

                  <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
                    <Button onClick={handleSaveConfig} disabled={isSaving}>
                      {isSaving ? "Saving..." : "Save Configuration"}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* CSS TAB */}
              <TabsContent value="css" className="space-y-4 pt-4">
                {/* Header */}
                <div className="flex items-center gap-3 pb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Check className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Custom CSS</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Add custom CSS to style the embedded chat widget. Max 10KB.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
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
                    className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono resize-y"
                  />
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {customCss.length}/10240
                    </p>
                    <Button onClick={handleSaveCustomCss} disabled={isSaving}>
                      {isSaving ? "Saving..." : "Save CSS"}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* CODE TAB */}
              <TabsContent value="code" className="space-y-6 pt-4">
                {/* Embed Token */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Globe className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Embed Token</h2>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        The embed token is the project ID. This token is used to access your embedded chat.
                      </p>
                    </div>
                  </div>
                  <Input
                    value={embedToken || ""}
                    readOnly
                    className="font-mono text-sm bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                  />
                </div>

                {/* Embed URL */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Globe className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Embed URL</h2>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        The direct URL to access your embedded chat widget
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Input
                      value={embedToken ? `${window.location.origin}/embed?projectId=${encodeURIComponent(projectId)}&embedToken=${encodeURIComponent(embedToken)}` : ""}
                      readOnly
                      className="font-mono text-sm bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                    />
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Use this URL to directly access your embedded chat or open in a new tab.
                    </p>
                  </div>
                </div>

                {/* Widget Size */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Widget Size</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="width" className="text-sm font-medium text-slate-700 dark:text-slate-300">Width</Label>
                      <Input
                        id="width"
                        value={width}
                        onChange={(e) => setWidth(e.target.value)}
                        placeholder="400px"
                        className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="height" className="text-sm font-medium text-slate-700 dark:text-slate-300">Height</Label>
                      <Input
                        id="height"
                        value={height}
                        onChange={(e) => setHeight(e.target.value)}
                        placeholder="600px"
                        className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                      />
                    </div>
                  </div>
                </div>

                {/* Code Type */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Embed Code Type</h3>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setCodeType("iframe")}
                      variant={codeType === "iframe" ? "default" : "outline"}
                      size="sm"
                      className={codeType === "iframe" ? "" : "bg-white dark:bg-slate-900"}
                    >
                      iframe
                    </Button>
                    <Button
                      onClick={() => setCodeType("javascript")}
                      variant={codeType === "javascript" ? "default" : "outline"}
                      size="sm"
                      className={codeType === "javascript" ? "" : "bg-white dark:bg-slate-900"}
                    >
                      JavaScript
                    </Button>
                  </div>
                </div>

                {/* Embed Code */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Code2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Embed Code</h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Copy and paste this code into your website
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={handleCopyCode}
                      variant="outline"
                      size="sm"
                      className="bg-white dark:bg-slate-900"
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
                  <div className="relative">
                    <textarea
                      readOnly
                      value={embedCode}
                      onClick={(e) => e.currentTarget.select()}
                      className="w-full min-h-[200px] rounded-md border border-slate-300 dark:border-slate-700 bg-slate-950 px-4 py-3 text-sm font-mono text-slate-50 resize-y"
                    />
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                      Click the code to select all, then copy and paste into your website.
                    </p>
                  </div>
                </div>

                {userMode === "uid" && (
                  <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4">
                    <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-2 text-sm flex items-center gap-2">
                      <Check className="h-4 w-4" />
                      Using UID Parameter for User History
                    </h4>
                    <p className="text-sm text-blue-800 dark:text-blue-400 mb-3">
                      To maintain separate conversation history for each user, add a uid parameter to the embed URL.
                    </p>
                    <pre className="text-sm text-blue-900 dark:text-blue-200 bg-blue-100 dark:bg-blue-900/30 p-3 rounded-md overflow-x-auto font-mono">
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
    </AppLayout>
  );
}
