import { useEffect, useState, useRef } from "react";
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
import { LayoutGrid, Upload, Search, List, Grid3x3, FileText, Image as ImageIcon, File } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

type ApiError = {
  message: string;
  status?: number;
  code?: string;
};

type FileItem = {
  id: string;
  name: string;
  size: number;
  type: string;
  uploaded_at: string;
  project_id: string;
  url?: string;
  preview?: string;
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

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

function getFileTypeAlias(type: string): string {
  if (!type) return "File";

  // Image types
  if (type.includes("jpg") || type.includes("jpeg") || type.includes("webp") || type.includes("png") || type.includes("gif") || type.includes("svg") || type.includes("bmp") || type.includes("ico")) {
    return "Image";
  }

  // Document types
  if (type.includes("pdf") || type.includes("word") || type.includes("document") || type.includes("csv") || type.includes("text") || type.includes("excel") || type.includes("powerpoint") || type.includes("presentation")) {
    return "Doc";
  }

  // Archive types
  if (type.includes("zip") || type.includes("rar") || type.includes("tar") || type.includes("7z")) {
    return "Archive";
  }

  // Video types
  if (type.includes("video") || type.includes("mp4") || type.includes("avi") || type.includes("mov")) {
    return "Video";
  }

  // Audio types
  if (type.includes("audio") || type.includes("mp3") || type.includes("wav")) {
    return "Audio";
  }

  return "File";
}

function getFileIconComponent(type: string) {
  if (type.startsWith("image/")) {
    return ImageIcon;
  }
  if (type.includes("pdf")) return FileText;
  if (type.includes("word") || type.includes("document")) return FileText;
  if (type.includes("excel") || type.includes("spreadsheet")) return FileText;
  if (type.includes("powerpoint") || type.includes("presentation")) return FileText;
  if (type.includes("zip") || type.includes("rar") || type.includes("tar")) return File;
  if (type.includes("text")) return FileText;
  return File;
}

export default function FilesPage() {
  const params = useParams<{ projectId: string }>();
  const [location] = useLocation();
  const [, setLocation] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [fileTypeFilter, setFileTypeFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [uploading, setUploading] = useState(false);
  const [aiContext, setAiContext] = useState(false);

  const selectedProjectId = params.projectId || "";

  // Filter files based on search query and file type
  const filteredFiles = files.filter((file) => {
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType =
      fileTypeFilter === "all" ||
      (fileTypeFilter === "images" && file.type.startsWith("image/")) ||
      (fileTypeFilter === "docs" && !file.type.startsWith("image/"));
    return matchesSearch && matchesType;
  });

  // Get project ID from URL (fallback for legacy routes)
  useEffect(() => {
    if (!selectedProjectId) {
      const match = location.match(/\/projects\/([^\/]+)/);
      if (match) {
        const projectId = match[1];
        setLocation(`/projects/${projectId}/files`);
      }
    }
  }, [location, selectedProjectId, setLocation]);

  // Load files from localStorage on mount
  useEffect(() => {
    const storedFiles = localStorage.getItem("uploaded-files");
    if (storedFiles) {
      const parsedFiles = JSON.parse(storedFiles);
      setFiles(parsedFiles);
    }
  }, []);

  // Save files to localStorage whenever files change
  useEffect(() => {
    if (files.length > 0) {
      localStorage.setItem("uploaded-files", JSON.stringify(files));
    }
  }, [files]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      // Create file preview for images using Base64
      let preview: string | undefined;
      if (file.type.startsWith("image/")) {
        preview = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });
        console.log("Image preview created (Base64):", preview ? "created" : "failed", "for file:", file.name, "type:", file.type);
      }

      // Create new file item
      const newFile: FileItem = {
        id: Date.now().toString(),
        name: file.name,
        size: file.size,
        type: file.type,
        uploaded_at: new Date().toISOString(),
        project_id: selectedProjectId || "default",
        url: preview,
        preview: preview,
      };

      console.log("New file created:", newFile);

      // Add to files state
      setFiles((prev) => {
        const updated = [newFile, ...prev];
        console.log("Files state updated:", updated);
        return updated;
      });

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Failed to upload file. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleToggleFileSelection = (fileId: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId);
    } else {
      newSelected.add(fileId);
    }
    setSelectedFiles(newSelected);
    setSelectAll(newSelected.size === filteredFiles.length && filteredFiles.length > 0);
  };

  const handleDeleteFile = (fileId: string) => {
    if (!confirm("Are you sure you want to delete this file?")) {
      return;
    }

    setFiles((prev) => prev.filter((f) => f.id !== fileId));
    setSelectedFiles((prev) => {
      const newSet = new Set(prev);
      newSet.delete(fileId);
      return newSet;
    });
  };

  return (
    <AppLayout
      header={
        <div className="flex w-full items-center justify-between">
          {/* Left side - Breadcrumb */}
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/" className="flex items-center gap-2 text-sm">
                  <LayoutGrid className="h-4 w-4" />
                  Projects
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-sm">Files</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Right side - Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Select All Checkbox */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="select-all"
                checked={selectAll}
                onCheckedChange={(checked) => {
                  const isChecked = checked === true;
                  setSelectAll(isChecked);
                  if (isChecked) {
                    setSelectedFiles(new Set(filteredFiles.map(f => f.id)));
                  } else {
                    setSelectedFiles(new Set());
                  }
                }}
              />
              <Label htmlFor="select-all" className="text-sm cursor-pointer whitespace-nowrap">
                Select all
              </Label>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-48 pl-9"
              />
            </div>

            {/* File Type Filter Select */}
            <Select value={fileTypeFilter} onValueChange={setFileTypeFilter}>
              <SelectTrigger className="h-9 w-36">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="images">Images</SelectItem>
                <SelectItem value="docs">Docs</SelectItem>
              </SelectContent>
            </Select>

            {/* Upload Button */}
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
              id="file-upload"
            />
            <Button
              className="h-9"
              size="sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? "Uploading..." : "Upload"}
            </Button>

            {/* View Mode Buttons */}
            <div className="flex items-center gap-1 border border-slate-200 rounded-md p-1">
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setViewMode("grid")}
                title="Grid view"
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setViewMode("list")}
                title="List view"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      }
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pt-6">
        {filteredFiles.length === 0 ? (
          <Card className="border-slate-200">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <LayoutGrid className="h-16 w-16 text-slate-300 mb-4" />
              <p className="text-lg font-medium text-slate-600 mb-2">No files yet</p>
              <p className="text-sm text-slate-500 mb-4">
                {searchQuery || fileTypeFilter !== "all"
                  ? "No files match your search or filter criteria."
                  : "Upload your first file to get started."}
              </p>
              {!uploading && (
                <Button onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload File
                </Button>
              )}
            </CardContent>
          </Card>
        ) : viewMode === "grid" ? (
          // Grid View - Direct display without container
          <div className="flex flex-wrap gap-3 justify-start -mt-2">
            {filteredFiles.map((file) => {
              const FileIconComponent = getFileIconComponent(file.type);
              const isSelected = selectedFiles.has(file.id);
              const isImage = file.type.startsWith("image/");

              console.log("Rendering file:", file.name, "type:", file.type, "isImage:", isImage, "hasPreview:", !!file.preview);

              return (
                <Card
                  key={file.id}
                  className={`group relative overflow-hidden transition-all hover:shadow-md w-[200px] sm:w-[180px] md:w-[200px] ${
                    isSelected ? "ring-2 ring-primary" : ""
                  }`}
                >
                  {/* Image preview - Full width with rounded top corners */}
                  <div className="relative h-[100px] mx-2 mt-1 overflow-hidden rounded-t-lg">
                    {isImage && file.preview ? (
                      <img
                        src={file.preview}
                        alt={file.name}
                        className="w-full h-full object-cover rounded-t-lg"
                        onLoad={() => console.log("Image loaded successfully:", file.name)}
                        onError={() => console.log("Image failed to load:", file.name, file.preview)}
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-50 flex items-center justify-center p-2">
                        <FileIconComponent className="h-12 w-12 text-slate-400" />
                      </div>
                    )}

                    {/* Checkbox - Top left, only show on hover */}
                    <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleToggleFileSelection(file.id)}
                        className="h-4 w-4 bg-white/90 backdrop-blur border-2 border-white"
                      />
                    </div>

                    {/* Delete button - Top right, only show on hover */}
                    <button
                      onClick={() => handleDeleteFile(file.id)}
                      className="absolute top-2 right-2 p-1 bg-white/90 backdrop-blur rounded text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete file"
                    >
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="p-2 pb-1.5 space-y-1.5">
                    {/* File name - Bold and longer, centered */}
                    <p className="text-[10px] font-bold text-slate-900 line-clamp-2 leading-tight text-center" title={file.name}>
                      {file.name}
                    </p>

                    {/* File info - Size and Type, centered */}
                    <div className="flex items-center justify-center gap-1 text-[9px] text-slate-500">
                      <span>{formatFileSize(file.size)}</span>
                      <span>•</span>
                      <span className="capitalize">
                        {getFileTypeAlias(file.type)}
                      </span>
                    </div>

                    {/* AI Context Switch - Gray background container */}
                    <div className="flex items-center justify-between bg-slate-100 rounded px-2 py-1">
                      <span className="text-[9px] text-slate-600 font-medium">AI Context</span>
                      <Switch
                        checked={aiContext}
                        onCheckedChange={setAiContext}
                        className="scale-75"
                      />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          // List View
          <Card className="border-slate-200">
            <div className="divide-y divide-slate-100">
              {filteredFiles.map((file) => {
                const FileIconComponent = getFileIconComponent(file.type);
                const isSelected = selectedFiles.has(file.id);
                const isImage = file.type.startsWith("image/");

                return (
                  <div
                    key={file.id}
                    className={`flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors ${
                      isSelected ? "bg-primary/5" : ""
                    }`}
                  >
                    {/* Checkbox */}
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleToggleFileSelection(file.id)}
                    />

                    {/* File icon or thumbnail */}
                    <div className="flex-shrink-0">
                      {isImage && file.preview ? (
                        <img
                          src={file.preview}
                          alt={file.name}
                          className="h-12 w-12 object-cover rounded"
                        />
                      ) : (
                        <div className="h-12 w-12 bg-slate-100 rounded flex items-center justify-center">
                          <FileIconComponent className="h-6 w-6 text-slate-400" />
                        </div>
                      )}
                    </div>

                    {/* File info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" title={file.name}>
                        {file.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatFileSize(file.size)} • {file.type} • {new Date(file.uploaded_at).toLocaleDateString()}
                      </p>
                    </div>

                    {/* Actions */}
                    <button
                      onClick={() => handleDeleteFile(file.id)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="Delete file"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
