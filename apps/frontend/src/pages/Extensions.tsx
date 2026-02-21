import { useEffect, useState } from "react";
import { useParams } from "wouter";

import AppLayout from "@/components/app-layout";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Puzzle,
  Search,
  Globe,
  Database,
  FileText,
  Wrench,
  BarChart3,
  Loader2,
  LayoutGrid,
  RefreshCw,
  Bug,
  MoreVertical,
  Trash2,
  ChevronDown,
  ChevronUp,
  Copy,
  Edit,
  Power,
  RotateCcw,
  MessageSquare,
  Layers,
  FileText as FileTextIcon,
  Settings,
  Eye,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUIStore } from "@/stores";

// Types
interface ExtensionMetadata {
  id: string;
  name: string;
  description: string;
  author?: string;
  version: string;
  category: string;
  enabled: boolean;
  is_default: boolean;
  capabilities?: string[];
  error_count?: number;
  last_error?: string;
  has_error?: boolean;
  debug?: boolean;
}

// Helper function to get API base URL
const getApiBase = () => {
  return window.location.origin;
};

export default function ExtensionsPage() {
  const { user } = useAuth();
  const { addToast } = useUIStore();
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId || "";

  // Use a default project ID if not specified
  const effectiveProjectId = projectId || "default";

  const [extensions, setExtensions] = useState<ExtensionMetadata[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Action states
  const [togglingExtension, setTogglingExtension] = useState<string | null>(null);
  const [reloadingExtensions, setReloadingExtensions] = useState<Set<string>>(new Set());
  const [expandedCapabilities, setExpandedCapabilities] = useState<Set<string>>(new Set());

  // Dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [selectedExtension, setSelectedExtension] = useState<ExtensionMetadata | null>(null);
  const [newCategory, setNewCategory] = useState("");

  // Load data
  const loadData = async () => {
    setLoading(true);
    setError("");

    // Default/mock data - always have this as fallback
    const defaultExtensions = [
      // Documents
      {
        id: "pdf",
        name: "PDF",
        description: "Extract text content from PDF documents",
        author: "AIBase",
        version: "1.0.0",
        category: "Documents",
        enabled: true,
        is_default: true,
        capabilities: ["Process Uploaded Files", "Register Event Hooks", "Generate AI Titles", "Create Logger"],
      },
      {
        id: "excel",
        name: "Excel",
        description: "Extract data from Excel spreadsheets (.xlsx) with SQL support via DuckDB",
        author: "AIBase",
        version: "1.0.0",
        category: "Documents",
        enabled: true,
        is_default: true,
        capabilities: ["Process Uploaded Files", "Register Event Hooks", "Generate AI Titles", "Create Logger"],
      },
      {
        id: "word",
        name: "Word",
        description: "Extract text from Word documents (.docx)",
        author: "AIBase",
        version: "1.0.0",
        category: "Documents",
        enabled: true,
        is_default: true,
        capabilities: ["Process Uploaded Files", "Register Event Hooks", "Generate AI Titles", "Create Logger"],
      },
      {
        id: "image",
        name: "Image",
        description: "Analyze images using AI vision (OpenAI Vision API)",
        author: "AIBase",
        version: "1.0.0",
        category: "Documents",
        enabled: false,
        is_default: true,
        capabilities: ["Process Uploaded Files", "Register Event Hooks", "Generate AI Titles", "Create Logger", "Network Access"],
      },
      {
        id: "powerpoint",
        name: "PowerPoint",
        description: "Extract text from PowerPoint presentations (.pptx, .ppt)",
        author: "AIBase",
        version: "1.0.0",
        category: "Documents",
        enabled: false,
        is_default: true,
        capabilities: [],
      },
      // Web
      {
        id: "search",
        name: "Search",
        description: "Web and image search using Brave Search API",
        author: "AIBase",
        version: "1.0.0",
        category: "Web",
        enabled: false,
        is_default: true,
        capabilities: ["Network Access"],
      },
      // Database
      {
        id: "postgresql",
        name: "PostgreSQL",
        description: "Query PostgreSQL databases with secure credential storage",
        author: "AIBase",
        version: "1.0.0",
        category: "Database",
        enabled: false,
        is_default: true,
        capabilities: ["Read Stored Data", "Store Data", "Network Access"],
      },
      {
        id: "clickhouse",
        name: "ClickHouse",
        description: "Query ClickHouse databases",
        author: "AIBase",
        version: "1.0.0",
        category: "Database",
        enabled: false,
        is_default: false,
        capabilities: [],
      },
      {
        id: "trino",
        name: "Trino",
        description: "Query Trino databases",
        author: "AIBase",
        version: "1.0.0",
        category: "Database",
        enabled: false,
        is_default: false,
        capabilities: [],
      },
      // Visualization
      {
        id: "chart",
        name: "Chart",
        description: "Display interactive charts (bar, line, pie, area) using ECharts",
        author: "AIBase",
        version: "1.0.0",
        category: "Visualization",
        enabled: false,
        is_default: true,
        capabilities: [],
      },
      {
        id: "table",
        name: "Table",
        description: "Display tabular data with sortable columns",
        author: "AIBase",
        version: "1.0.0",
        category: "Visualization",
        enabled: false,
        is_default: true,
        capabilities: [],
      },
      {
        id: "mermaid",
        name: "Mermaid",
        description: "Render Mermaid diagrams (flowcharts, sequence diagrams)",
        author: "AIBase",
        version: "1.0.0",
        category: "Visualization",
        enabled: false,
        is_default: true,
        capabilities: [],
      },
      // Chat
      {
        id: "chat-logger",
        name: "Chat Logger",
        description: "Log chat messages for analytics (read-only)",
        author: "AIBase",
        version: "1.0.0",
        category: "Chat",
        enabled: false,
        is_default: true,
        capabilities: ["Read Chat Messages", "Register Event Hooks"],
      },
      {
        id: "profanity-filter",
        name: "Profanity Filter",
        description: "Filter inappropriate content from user messages",
        author: "AIBase",
        version: "1.0.0",
        category: "Chat",
        enabled: false,
        is_default: true,
        capabilities: ["Read Chat Messages", "Modify Chat Messages", "Register Event Hooks"],
      },
      {
        id: "response-enhancer",
        name: "Response Enhancer",
        description: "Add formatting and disclaimers to AI responses",
        author: "AIBase",
        version: "1.0.0",
        category: "Chat",
        enabled: false,
        is_default: true,
        capabilities: ["Read Chat Messages", "Modify Chat Messages", "Register Event Hooks"],
      },
      // Context
      {
        id: "context-manager",
        name: "Context Manager",
        description: "Read/modify conversation context and compaction settings",
        author: "AIBase",
        version: "1.0.0",
        category: "Context",
        enabled: false,
        is_default: true,
        capabilities: ["context", "compaction"],
      },
      // Utilities
      {
        id: "peek",
        name: "Peek",
        description: "Paginated view of large outputs",
        author: "AIBase",
        version: "1.0.0",
        category: "Utilities",
        enabled: false,
        is_default: true,
        capabilities: [],
      },
      {
        id: "extension-creator",
        name: "Extension Creator",
        description: "Create extensions via natural language",
        author: "AIBase",
        version: "1.0.0",
        category: "Utilities",
        enabled: false,
        is_default: true,
        capabilities: [],
      },
    ];

    const defaultCategories = [
      { id: "database", name: "Database" },
      { id: "documents", name: "Documents" },
      { id: "utilities", name: "Utilities" },
      { id: "visualization", name: "Visualization" },
      { id: "web", name: "Web" },
      { id: "chat", name: "Chat" },
      { id: "context", name: "Context" },
    ];

    // If no project ID or for demo, use mock data
    if (!projectId) {
      setExtensions(defaultExtensions);
      setCategories(defaultCategories);
      setLoading(false);
      return;
    }

    try {
      const apiBase = getApiBase();

      // Fetch extensions
      const extResponse = await fetch(`${apiBase}/projects/${effectiveProjectId}/extensions`, {
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (extResponse.ok) {
        const extData = await extResponse.json();
        if (extData.extensions && extData.extensions.length > 0) {
          setExtensions(extData.extensions);
        } else {
          // Use default if API returns empty
          setExtensions(defaultExtensions);
        }
      } else {
        // API error, use defaults
        console.warn(`API returned ${extResponse.status}, using default extensions`);
        setExtensions(defaultExtensions);
      }

      // Fetch categories
      const catResponse = await fetch(`${apiBase}/categories`, {
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (catResponse.ok) {
        const catData = await catResponse.json();
        if (catData.categories && catData.categories.length > 0) {
          setCategories(catData.categories);
        } else {
          setCategories(defaultCategories);
        }
      } else {
        setCategories(defaultCategories);
      }
    } catch (err) {
      console.warn("Failed to load extensions, using defaults:", err);
      // Always show extensions, even on error
      setExtensions(defaultExtensions);
      setCategories(defaultCategories);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  // Toggle extension
  const handleToggleExtension = async (ext: ExtensionMetadata) => {
    setTogglingExtension(ext.id);
    setError("");

    // Demo mode: just toggle locally without API call
    if (!projectId) {
      setExtensions(extensions.map((e) =>
        e.id === ext.id ? { ...e, enabled: !e.enabled } : e
      ));
      addToast({
        type: "success",
        title: !ext.enabled ? "Extension enabled (demo mode)" : "Extension disabled (demo mode)",
        duration: 2000,
      });
      setTogglingExtension(null);
      return;
    }

    try {
      const apiBase = getApiBase();
      const response = await fetch(`${apiBase}/projects/${effectiveProjectId}/extensions/${ext.id}/toggle`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        let errorMsg = `Failed to toggle extension: ${response.status}`;
        try {
          const errData = await response.json();
          if (errData.message) errorMsg = errData.message;
          if (errData.error) errorMsg = errData.error;
        } catch {}
        console.error("Toggle error response:", errorMsg);
        throw new Error(errorMsg);
      }

      const data = await response.json();

      // Update local state
      setExtensions(extensions.map((e) =>
        e.id === ext.id ? { ...e, enabled: data.extension.enabled } : e
      ));

      addToast({
        type: "success",
        title: data.extension.enabled ? "Extension enabled" : "Extension disabled",
        duration: 2000,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle extension");
      addToast({
        type: "error",
        title: "Failed to toggle extension",
      });
    } finally {
      setTogglingExtension(null);
    }
  };

  // Reload extension
  const handleReloadExtension = async (ext: ExtensionMetadata) => {
    setReloadingExtensions((prev) => new Set(prev).add(ext.id));
    setError("");

    try {
      const apiBase = getApiBase();
      const response = await fetch(`${apiBase}/projects/${effectiveProjectId}/extensions/${ext.id}/reload`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to reload extension: ${response.status}`);
      }

      // Update local state
      setExtensions(extensions.map((e) =>
        e.id === ext.id ? { ...e, error_count: 0, last_error: "", has_error: false } : e
      ));

      addToast({
        type: "success",
        title: "Extension reloaded",
        duration: 2000,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reload extension");
      addToast({
        type: "error",
        title: "Failed to reload extension",
      });
    } finally {
      setReloadingExtensions((prev) => {
        const next = new Set(prev);
        next.delete(ext.id);
        return next;
      });
    }
  };

  // Toggle debug mode
  const handleToggleDebug = async (ext: ExtensionMetadata) => {
    setError("");

    try {
      const apiBase = getApiBase();
      const response = await fetch(`${apiBase}/projects/${effectiveProjectId}/extensions/${ext.id}/debug`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ debug: !ext.debug }),
      });

      if (!response.ok) {
        throw new Error(`Failed to toggle debug mode: ${response.status}`);
      }

      // Update local state
      setExtensions(extensions.map((e) =>
        e.id === ext.id ? { ...e, debug: !e.debug } : e
      ));

      addToast({
        type: "success",
        title: !ext.debug ? "Debug mode enabled" : "Debug mode disabled",
        duration: 2000,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle debug mode");
      addToast({
        type: "error",
        title: "Failed to toggle debug mode",
      });
    }
  };

  // Open delete dialog
  const openDeleteDialog = (ext: ExtensionMetadata) => {
    setSelectedExtension(ext);
    setDeleteDialogOpen(true);
  };

  // Delete extension
  const handleDeleteExtension = async () => {
    if (!selectedExtension) return;

    setError("");

    try {
      const apiBase = getApiBase();
      const response = await fetch(`${apiBase}/projects/${effectiveProjectId}/extensions/${selectedExtension.id}`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to delete extension: ${response.status}`);
      }

      // Remove from local state
      setExtensions(extensions.filter((e) => e.id !== selectedExtension.id));

      addToast({
        type: "success",
        title: "Extension deleted",
        duration: 2000,
      });

      setDeleteDialogOpen(false);
      setSelectedExtension(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete extension");
      addToast({
        type: "error",
        title: "Failed to delete extension",
      });
    }
  };

  // Open category dialog
  const openCategoryDialog = (ext: ExtensionMetadata) => {
    setSelectedExtension(ext);
    setNewCategory(ext.category);
    setCategoryDialogOpen(true);
  };

  // Change category
  const handleChangeCategory = async () => {
    if (!selectedExtension) return;

    setError("");

    try {
      const apiBase = getApiBase();
      const response = await fetch(`${apiBase}/projects/${effectiveProjectId}/extensions/${selectedExtension.id}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ category: newCategory }),
      });

      if (!response.ok) {
        throw new Error(`Failed to change category: ${response.status}`);
      }

      // Update local state
      setExtensions(extensions.map((e) =>
        e.id === selectedExtension.id ? { ...e, category: newCategory } : e
      ));

      addToast({
        type: "success",
        title: "Category changed",
        duration: 2000,
      });

      setCategoryDialogOpen(false);
      setSelectedExtension(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change category");
      addToast({
        type: "error",
        title: "Failed to change category",
      });
    }
  };

  // Reset to defaults
  const handleResetToDefaults = async () => {
    setError("");

    try {
      const apiBase = getApiBase();
      const response = await fetch(`${apiBase}/projects/${effectiveProjectId}/extensions-reset`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to reset extensions: ${response.status}`);
      }

      const data = await response.json();

      // Update local state
      setExtensions(data.extensions || []);

      addToast({
        type: "success",
        title: "Extensions reset to defaults",
        duration: 2000,
      });

      setResetDialogOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset extensions");
      addToast({
        type: "error",
        title: "Failed to reset extensions",
      });
    }
  };

  // Filter extensions
  const filteredExtensions = extensions.filter((ext) => {
    const matchesSearch = ext.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ext.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" ||
      ext.category.toLowerCase() === selectedCategory.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  // Category configuration
  const categoryConfig = [
    { id: "all", label: "All Extensions", icon: null },
    { id: "database", label: "Database", icon: Database },
    { id: "documents", label: "Documents", icon: FileText },
    { id: "utilities", label: "Utilities", icon: Wrench },
    { id: "visualization", label: "Visualization", icon: BarChart3 },
    { id: "web", label: "Web", icon: Globe },
    { id: "chat", label: "Chat", icon: MessageSquare },
    { id: "context", label: "Context", icon: Layers },
  ];

  const getCategoryCount = (categoryId: string) => {
    if (categoryId === "all") return extensions.length;
    return extensions.filter(ext => ext.category.toLowerCase() === categoryId.toLowerCase()).length;
  };

  const getCapabilityBadgeColor = (capability: string) => {
    const lower = capability.toLowerCase();
    if (lower.includes("network") || lower.includes("web")) return "bg-orange-100 text-orange-700 border-orange-200";
    if (lower.includes("read") || lower.includes("chat")) return "bg-green-100 text-green-700 border-green-200";
    if (lower.includes("write") || lower.includes("modify")) return "bg-red-100 text-red-700 border-red-200";
    return "bg-blue-100 text-blue-700 border-blue-200";
  };

  const getCapabilityTagColor = (capability: string) => {
    const lower = capability.toLowerCase();
    if (lower.includes("network") || lower.includes("web")) return "bg-orange-400";
    if (lower.includes("read") || lower.includes("chat")) return "bg-emerald-500";
    if (lower.includes("write") || lower.includes("modify")) return "bg-blue-500";
    if (lower.includes("process") || lower.includes("upload")) return "bg-yellow-400";
    if (lower.includes("generate") || lower.includes("ai")) return "bg-purple-500";
    return "bg-gray-500";
  };

  const getCategoryIcon = (category: string) => {
    const lower = category.toLowerCase();
    switch (lower) {
      case "database": return Database;
      case "documents": return FileText;
      case "utilities": return Wrench;
      case "visualization": return BarChart3;
      case "web": return Globe;
      case "chat": return MessageSquare;
      case "context": return Layers;
      default: return Puzzle;
    }
  };

  return (
    <AppLayout
      header={
        <div className="flex items-center justify-between w-full">
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
                <BreadcrumbPage>Extensions</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search extensions..."
                className="w-64 pl-10"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("all");
              }}
              className="h-9 font-semibold"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        {error && (
          <div className="w-full rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2">
          {categoryConfig.map((cat) => {
            const Icon = cat.icon;
            const count = getCategoryCount(cat.id);
            return (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.id ? "default" : "outline"}
                onClick={() => setSelectedCategory(cat.id)}
                className={selectedCategory === cat.id ? "bg-black text-white hover:bg-gray-800" : ""}
              >
                {Icon && <Icon className="mr-2 h-4 w-4" />}
                {cat.label} ({count})
              </Button>
            );
          })}
        </div>

        {/* Extension Cards */}
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : filteredExtensions.length === 0 ? (
          <div className="py-12 text-center">
            <Puzzle className="mx-auto mb-4 h-12 w-12 text-gray-400" />
            <h3 className="mb-2 text-lg font-semibold text-gray-900">No extensions found</h3>
            <p className="text-sm text-gray-500">
              {searchQuery ? "Try a different search term" : "No extensions available"}
            </p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filteredExtensions.map((ext) => (
              <Card
                key={ext.id}
                className={`hover:shadow-md transition-shadow border rounded-lg ${
                  ext.enabled
                    ? "border-emerald-200 bg-emerald-50/30"
                    : "border-gray-200"
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col">
                    {/* Header: Icon, Title, Description */}
                    <div className="flex items-start gap-3">
                      {/* Extension Icon */}
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gray-100">
                        <Puzzle className="h-6 w-6 text-emerald-600" />
                      </div>

                      {/* Title and Description - SEJAJAR */}
                      <div className="flex min-w-0 flex-1 flex-col">
                        <h3 className="font-semibold text-gray-900 text-base">{ext.name}</h3>
                        <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                          {ext.description}
                        </p>

                        {/* Version, Provider - SEJAJAR DESKRIPSI */}
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                          <span>v1.0.0</span>
                          <span>•</span>
                          <span>Maldevta</span>
                        </div>

                        {/* Built-in Badge - DI BAWAH VERSI, BARIS BARU */}
                        {ext.is_default && (
                          <div className="mt-2">
                            <span className="px-2 py-0.5 rounded border border-gray-300 text-gray-600 text-xs">
                              Built-in
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* GARIS PEMBATAS 1 - Sebelum Capabilities */}
                    <div className="border-t border-gray-100 my-3"></div>

                    {/* Capabilities Tags */}
                    {ext.capabilities && ext.capabilities.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 mb-3">
                        {ext.capabilities.slice(0, 3).map((cap, idx) => (
                          <span
                            key={idx}
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white ${getCapabilityTagColor(cap)}`}
                          >
                            {cap}
                          </span>
                        ))}
                        {ext.capabilities.length > 3 && (
                          <span className="text-xs text-gray-500">
                            +{ext.capabilities.length - 3} more
                          </span>
                        )}
                      </div>
                    )}

                    {/* GARIS PEMBATAS 2 - Sebelum Action Buttons */}
                    <div className="border-t border-gray-100 my-3"></div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      {/* Disable/Enable Button with Icon */}
                      <Button
                        size="default"
                        onClick={() => handleToggleExtension(ext)}
                        disabled={togglingExtension === ext.id}
                        variant="outline"
                        className={`h-9 px-4 text-sm font-semibold border ${
                          ext.enabled
                            ? "border-emerald-300 text-emerald-600 bg-white hover:bg-emerald-50"
                            : "border-gray-300 text-gray-600 bg-white hover:bg-gray-50"
                        }`}
                      >
                        {togglingExtension === ext.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Power className={`h-4 w-4 mr-2 ${ext.enabled ? "text-emerald-600" : "text-gray-400"}`} />
                            {ext.enabled ? "Disable" : "Enable"}
                          </>
                        )}
                      </Button>

                      <div className="flex items-center gap-1 ml-auto">
                        {/* Refresh */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReloadExtension(ext)}
                          disabled={!ext.enabled || reloadingExtensions.has(ext.id)}
                          className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                          title="Reload"
                        >
                          {reloadingExtensions.has(ext.id) ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3 w-3" />
                          )}
                        </Button>

                        {/* Enable Debug - BUG ICON */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleDebug(ext)}
                          className={`h-6 w-6 p-0 rounded ${
                            ext.debug
                              ? "text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                          }`}
                          title={ext.debug ? "Disable debug" : "Enable debug"}
                        >
                          <Bug className="h-3 w-3" />
                        </Button>

                        {/* Change Category - EDIT ICON */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openCategoryDialog(ext)}
                          className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                          title="Change category"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>

                        {/* Delete */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDeleteDialog(ext)}
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Error Display */}
                    {ext.has_error && ext.last_error && (
                      <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
                        {ext.last_error}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* User Info */}
        {user && (
          <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
            <div className="flex items-center justify-between">
              <span>Signed in as: <span className="font-medium">{user.role}</span></span>
              <span className="font-mono">{user.userId?.slice(0, 8)}...</span>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Extension</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedExtension?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteExtension}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Category</DialogTitle>
            <DialogDescription>
              Select a new category for "{selectedExtension?.name}".
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {categories.map((cat) => (
              <Button
                key={cat.id}
                variant={newCategory === cat.name ? "default" : "outline"}
                onClick={() => setNewCategory(cat.name)}
                className="justify-start"
              >
                {cat.name}
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleChangeCategory}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset to Defaults Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset to Defaults</DialogTitle>
            <DialogDescription>
              This will delete all custom extensions and reset all extensions to their default state. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleResetToDefaults}>
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
