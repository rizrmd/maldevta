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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Puzzle, Search, X, Globe, Database, FileText, Wrench, BarChart3, Loader2, LayoutGrid } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";




type ExtensionResponse = {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: string;
  enabled: boolean;
  installed_at?: string;
  capabilities?: string[];
  builtin?: boolean;
};

const AIHUB_API = "https://hub.maldevta.com";

export default function ExtensionsPage() {
  const { user } = useAuth();
  const params = useParams<{ projectId: string }>();
  const [location] = useLocation();
  const [, setLocation] = useLocation();

  const [extensions, setExtensions] = useState<ExtensionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const selectedProjectId = params.projectId || "";

  // Get project ID from URL (fallback for legacy routes)
  useEffect(() => {
    if (!selectedProjectId) {
      const match = location.match(/\/extensions\/([^\/]+)/);
      if (match) {
        // Legacy route - redirect to new route
        const projectId = match[1];
        setLocation(`/extensions/${projectId}`);
      }
    }
  }, [location, selectedProjectId, setLocation]);

  // Fetch extensions from aihub
  const loadExtensions = async () => {
    setLoading(true);
    setError("");

    try {
      // Use mock data for development since API is not available yet
      // TODO: Replace with actual API call when backend is ready
      // const response = await fetch(`${AIHUB_API}/extensions/list`, {
      //   headers: {
      //     "Content-Type": "application/json",
      //   },
      // });

      // if (!response.ok) {
      //   throw new Error(`Failed to fetch extensions: ${response.status}`);
      // }

      // const data = await response.json();

      // Mock data for development
      const data = {
        extensions: [
          {
            id: "world-weather",
            name: "World Weather",
            description: "Check weather in cities worldwide. Get current conditions, forecasts, and weather alerts.",
            version: "2.0.0",
            author: "AIBase",
            category: "Web",
            capabilities: ["Network Access"],
            builtin: true,
            installed_at: new Date().toISOString(),
          },
          {
            id: "sql-query",
            name: "SQL Query Executor",
            description: "Execute SQL queries on your databases safely. Supports SELECT, INSERT, UPDATE operations.",
            version: "1.5.0",
            author: "AIBase",
            category: "Database",
            capabilities: ["Network Access", "Read Chat Messages"],
            builtin: true,
            installed_at: new Date().toISOString(),
          },
          {
            id: "doc-parser",
            name: "Document Parser",
            description: "Parse and extract content from PDF, DOCX, and TXT files. Supports batch processing.",
            version: "3.1.0",
            author: "AIBase",
            category: "Documents",
            capabilities: ["Read Chat Messages"],
            builtin: true,
            installed_at: new Date().toISOString(),
          },
          {
            id: "data-viz",
            name: "Data Visualizer",
            description: "Create beautiful charts and graphs from your data. Supports bar, line, pie charts.",
            version: "1.2.0",
            author: "AIBase",
            category: "Visualization",
            capabilities: ["Read Chat Messages"],
            builtin: false,
            installed_at: new Date().toISOString(),
          },
          {
            id: "api-client",
            name: "REST API Client",
            description: "Make HTTP requests to external APIs. Handle authentication and rate limiting.",
            version: "2.3.0",
            author: "AIBase",
            category: "Utilities",
            capabilities: ["Network Access"],
            builtin: false,
          },
          {
            id: "csv-importer",
            name: "CSV Importer",
            description: "Import and process CSV files with automatic type detection and validation.",
            version: "1.0.0",
            author: "AIBase",
            category: "Database",
            capabilities: ["Read Chat Messages"],
            builtin: true,
            installed_at: new Date().toISOString(),
          },
          {
            id: "web-scraper",
            name: "Web Scraper",
            description: "Extract data from web pages automatically. Handles pagination and dynamic content.",
            version: "1.8.0",
            author: "AIBase",
            category: "Web",
            capabilities: ["Network Access"],
            builtin: false,
          },
          {
            id: "image-ocr",
            name: "Image OCR",
            description: "Extract text from images using optical character recognition. Supports multiple languages.",
            version: "2.0.0",
            author: "AIBase",
            category: "Utilities",
            capabilities: ["Read Chat Messages"],
            builtin: false,
            installed_at: new Date().toISOString(),
          },
          {
            id: "chart-builder",
            name: "Chart Builder",
            description: "Build interactive charts and dashboards. Export to PNG, SVG, or PDF formats.",
            version: "1.4.0",
            author: "AIBase",
            category: "Visualization",
            capabilities: ["Read Chat Messages", "Write Chat Messages"],
            builtin: false,
          },
          {
            id: "pdf-generator",
            name: "PDF Generator",
            description: "Generate professional PDF documents from templates or raw data.",
            version: "1.1.0",
            author: "AIBase",
            category: "Documents",
            capabilities: ["Write Chat Messages"],
            builtin: true,
            installed_at: new Date().toISOString(),
          },
          {
            id: "json-formatter",
            name: "JSON Formatter",
            description: "Format, validate, and minify JSON data. Includes schema validation.",
            version: "1.0.0",
            author: "AIBase",
            category: "Utilities",
            capabilities: [],
            builtin: true,
            installed_at: new Date().toISOString(),
          },
          {
            id: "mongodb-client",
            name: "MongoDB Client",
            description: "Connect and query MongoDB databases. Aggregation pipeline support.",
            version: "1.3.0",
            author: "AIBase",
            category: "Database",
            capabilities: ["Network Access", "Read Chat Messages"],
            builtin: false,
          },
          {
            id: "url-monitor",
            name: "URL Monitor",
            description: "Monitor websites for changes and get notified when content updates.",
            version: "1.6.0",
            author: "AIBase",
            category: "Web",
            capabilities: ["Network Access"],
            builtin: false,
            installed_at: new Date().toISOString(),
          },
          {
            id: "excel-exporter",
            name: "Excel Exporter",
            description: "Export data to Excel spreadsheets with formatting and formulas.",
            version: "1.2.0",
            author: "AIBase",
            category: "Documents",
            capabilities: ["Write Chat Messages"],
            builtin: false,
          },
        ],
      };

      // Transform response to match ExtensionResponse format
      const extensionList: ExtensionResponse[] = (data.extensions || []).map((ext: any) => ({
        id: ext.id,
        name: ext.name,
        description: ext.description,
        version: ext.version || "1.0.0",
        author: ext.author || "AIBase",
        category: ext.category || "Tools",
        enabled: ext.installed_at !== undefined,
        installed_at: ext.installed_at,
        capabilities: ext.capabilities || [],
        builtin: ext.builtin || false,
      }));

      setExtensions(extensionList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load extensions");
    } finally {
      setLoading(false);
    }
  };

  // Load extensions on mount
  useEffect(() => {
    loadExtensions();
  }, []);

  // Filter extensions
  const filteredExtensions = extensions.filter((ext) => {
    const matchesSearch = ext.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ext.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || ext.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleToggleExtension = async (extId: string) => {
    try {
      const response = await fetch(`${AIHUB_API}/extensions/${extId}/toggle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to toggle extension: ${response.status}`);
      }

      // Update local state
      setExtensions(extensions.map((ext) =>
        ext.id === extId ? { ...ext, enabled: !ext.enabled } : ext
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle extension");
    }
  };

  // Category configuration with icons and counts
  const categories = [
    { id: "all", label: "All Extensions", icon: null },
    { id: "database", label: "Database", icon: Database },
    { id: "documents", label: "Documents", icon: FileText },
    { id: "utilities", label: "Utilities", icon: Wrench },
    { id: "visualization", label: "Visualization", icon: BarChart3 },
    { id: "web", label: "Web", icon: Globe },
  ];

  // Get count for each category
  const getCategoryCount = (categoryId: string) => {
    if (categoryId === "all") return extensions.length;
    return extensions.filter(ext => ext.category.toLowerCase() === categoryId.toLowerCase()).length;
  };

  // Get capability badge color
  const getCapabilityBadgeColor = (capability: string) => {
    const lower = capability.toLowerCase();
    if (lower.includes("network") || lower.includes("web")) return "bg-orange-100 text-orange-700 border-orange-200";
    if (lower.includes("read") || lower.includes("chat")) return "bg-green-100 text-green-700 border-green-200";
    if (lower.includes("write") || lower.includes("modify")) return "bg-red-100 text-red-700 border-red-200";
    return "bg-blue-100 text-blue-700 border-blue-200";
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
            {searchQuery && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchQuery("")}
                className="h-9"
              >
                <X className="h-4 w-4" />
                Reset
              </Button>
            )}
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
          {categories.map((cat) => {
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

        {/* Extension Cards Grid */}
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : filteredExtensions.length === 0 ? (
          <div className="py-12 text-center">
            <Puzzle className="mx-auto mb-4 h-12 w-12 text-gray-400" />
            <h3 className="mb-2 text-lg font-semibold text-gray-900">No extensions found</h3>
            <p className="text-sm text-gray-500">
              {searchQuery ? "Try a different search term" : "No extensions available in this category"}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredExtensions.map((ext) => (
              <Card
                key={ext.id}
                className="group hover:shadow-md transition-shadow"
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Extension Icon */}
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                      <Puzzle className="h-6 w-6" />
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      {/* Title and Description */}
                      <div>
                        <h3 className="font-semibold text-gray-900">{ext.name}</h3>
                        <p className="line-clamp-2 text-sm text-gray-600">{ext.description}</p>
                      </div>

                      {/* Version and Author */}
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>v{ext.version}</span>
                        <span>•</span>
                        <span>{ext.author}</span>
                        {ext.builtin && (
                          <>
                            <span>•</span>
                            <span className="text-gray-400">Built-in</span>
                          </>
                        )}
                        {!ext.enabled && !ext.builtin && (
                          <>
                            <span>•</span>
                            <span className="text-red-500">Disabled</span>
                          </>
                        )}
                      </div>

                      {/* Capabilities Badges */}
                      {ext.capabilities && ext.capabilities.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {ext.capabilities.map((cap, idx) => (
                            <Badge
                              key={idx}
                              variant="outline"
                              className={`text-xs ${getCapabilityBadgeColor(cap)}`}
                            >
                              {cap}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Action Button */}
                      <div className="flex items-center justify-between pt-1">
                        <Button
                          size="sm"
                          onClick={() => handleToggleExtension(ext.id)}
                          className={ext.enabled ? "bg-teal-600 hover:bg-teal-700" : "bg-black hover:bg-gray-800"}
                        >
                          {ext.enabled ? "Disable" : "Enable"}
                        </Button>

                        {/* Action Icons */}
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-gray-400 hover:text-red-600"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </Button>
                        </div>
                      </div>
                    </div>
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
    </AppLayout>
  );
}
