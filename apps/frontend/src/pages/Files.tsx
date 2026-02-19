import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
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
import { Input } from "@/components/ui/input";
import { FileIcon, Upload, Trash2, FileText, Image, FileArchive, FileCode, Download, LayoutGrid } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type ApiError = {
  message: string;
  status?: number;
  code?: string;
};

type ProjectResponse = {
  id: string;
  name: string;
};

type ListProjectsResponse = {
  projects: ProjectResponse[];
};

type FileItem = {
  id: string;
  name: string;
  size: number;
  type: string;
  uploaded_at: string;
  project_id: string;
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

function getFileIcon(type: string) {
  if (type.startsWith("image/")) {
    return Image;
  }
  if (type.includes("zip") || type.includes("rar") || type.includes("tar")) {
    return FileArchive;
  }
  if (type.includes("json") || type.includes("javascript") || type.includes("text")) {
    return FileCode;
  }
  return FileText;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

export default function FilesPage() {
  const { user } = useAuth();
  const params = useParams<{ projectId: string }>();
  const [location] = useLocation();
  const [, setLocation] = useLocation();

  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const selectedProjectId = params.projectId || "";

  // Get project ID from URL (fallback for legacy routes)
  useEffect(() => {
    if (!selectedProjectId) {
      const match = location.match(/\/projects\/([^\/]+)/);
      if (match) {
        // Legacy route - redirect to new route
        const projectId = match[1];
        setLocation(`/projects/${projectId}/files`);
      }
    }
  }, [location, selectedProjectId, setLocation]);

  // Load projects
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const response = await apiRequest<ListProjectsResponse>("/projects");
        const projectList = response.projects || [];
        setProjects(projectList);
      } catch (err) {
        const apiError = err as ApiError;
        setError(apiError.message || "Failed to load projects");
      } finally {
        setLoading(false);
      }
    };
    loadProjects();
  }, []);

  // Load files for selected project
  useEffect(() => {
    if (!selectedProjectId) {
      setFiles([]);
      return;
    }

    // TODO: Implement API call to get files for project
    // For now, show placeholder data
    setFiles([
      {
        id: "1",
        name: "document.pdf",
        size: 1024000,
        type: "application/pdf",
        uploaded_at: new Date().toISOString(),
        project_id: selectedProjectId,
      },
      {
        id: "2",
        name: "image.png",
        size: 512000,
        type: "image/png",
        uploaded_at: new Date(Date.now() - 86400000).toISOString(),
        project_id: selectedProjectId,
      },
    ]);
  }, [selectedProjectId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProjectId) {
      return;
    }

    setUploading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      // TODO: Implement file upload API
      // await apiRequest(`/projects/${selectedProjectId}/files`, {
      //   method: "POST",
      //   body: formData,
      //   headers: {}, // Let browser set Content-Type with boundary
      // });

      // For now, add to local state
      const newFile: FileItem = {
        id: Date.now().toString(),
        name: file.name,
        size: file.size,
        type: file.type,
        uploaded_at: new Date().toISOString(),
        project_id: selectedProjectId,
      };
      setFiles([...files, newFile]);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || "Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm("Are you sure you want to delete this file?")) {
      return;
    }

    try {
      // TODO: Implement file delete API
      // await apiRequest(`/projects/${selectedProjectId}/files/${fileId}`, {
      //   method: "DELETE",
      // });

      setFiles(files.filter((f) => f.id !== fileId));
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || "Failed to delete file");
    }
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const totalStorage = files.reduce((acc, f) => acc + f.size, 0);

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
              <BreadcrumbPage>Files</BreadcrumbPage>
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
                File Management
              </p>
              <h1 className="font-display text-3xl text-slate-900 md:text-4xl">
                Project Files
              </h1>
              <p className="text-sm text-muted-foreground">
                Upload and manage files for your projects
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Project:</span>
                <Select value={selectedProjectId} onValueChange={(value) => setLocation(`/projects/${value}/files`)}>
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
              <Badge variant="outline" className="text-sm">
                {formatFileSize(totalStorage)}
              </Badge>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {!selectedProjectId ? (
            <div className="w-full rounded-lg border border-slate-200 bg-white/80 p-8 text-center">
              <FileIcon className="mx-auto h-12 w-12 text-slate-400" />
              <p className="mt-4 text-sm text-muted-foreground">
                No project selected. Please select a project from the URL or go back to Projects.
              </p>
            </div>
          ) : (
            <>
              {/* Upload Card */}
              <Card className="border-[#e6dccc] bg-white/80 backdrop-blur">
                <CardHeader>
                  <CardTitle>Upload Files</CardTitle>
                  <CardDescription>
                    Upload documents, images, or other files to {selectedProject?.name}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <label className="flex items-center gap-3">
                    <Input
                      type="file"
                      onChange={handleFileUpload}
                      disabled={uploading}
                      className="hidden"
                      id="file-upload"
                    />
                    <Button
                      asChild
                      disabled={uploading}
                      onClick={() => document.getElementById("file-upload")?.click()}
                    >
                      <span>
                        <Upload className="mr-2 h-4 w-4" />
                        {uploading ? "Uploading..." : "Choose File"}
                      </span>
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Supports: PDF, Images, Documents, and more
                    </span>
                  </label>
                </CardContent>
              </Card>

              {/* Files List */}
              <Card className="border-[#e6dccc] bg-white/80 backdrop-blur">
                <CardHeader>
                  <CardTitle>All Files</CardTitle>
                  <CardDescription>
                    {files.length} file{files.length !== 1 ? "s" : ""} in {selectedProject?.name}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {files.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      <FileIcon className="mx-auto mb-3 h-8 w-8 text-slate-400" />
                      No files uploaded yet. Upload your first file to get started.
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {files.map((file) => {
                        const FileIconComponent = getFileIcon(file.type);
                        return (
                          <div
                            key={file.id}
                            className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 transition-shadow hover:shadow-md"
                          >
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                              <FileIconComponent className="h-5 w-5 text-slate-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="truncate text-sm font-medium text-slate-900">
                                {file.name}
                              </p>
                              <p className="text-xs text-slate-500">
                                {formatFileSize(file.size)} • {new Date(file.uploaded_at).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                title="Download"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                title="Delete"
                                onClick={() => handleDeleteFile(file.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
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
              </div>
            </div>
          )}
        </div>
    </AppLayout>
  );
}
