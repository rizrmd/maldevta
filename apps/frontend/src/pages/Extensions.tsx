import { useEffect, useState } from "react";

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
import { Puzzle, Download, ExternalLink, Search, RefreshCw, Check } from "lucide-react";
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
};

const AIHUB_API = "https://hub.maldevta.com";

export default function ExtensionsPage() {
  const { user } = useAuth();
  const [extensions, setExtensions] = useState<ExtensionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Fetch extensions from aihub
  const loadExtensions = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${AIHUB_API}/extensions/list`, {
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch extensions: ${response.status}`);
      }

      const data = await response.json();

      // Transform aihub response to match ExtensionResponse format
      const extensionList: ExtensionResponse[] = (data.extensions || []).map((ext: any) => ({
        id: ext.id,
        name: ext.name,
        description: ext.description,
        version: ext.version || "1.0.0",
        author: ext.author || "Unknown",
        category: ext.category || "Tools",
        enabled: ext.installed_at !== undefined,
        installed_at: ext.installed_at || new Date().toISOString(),
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

  const categories = ["all", "tools", "developer", "storage", "communication"];

  return (
    <AppLayout
      header={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Extensions</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      }
    >
      <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden rounded-2xl border bg-linear-to-br from-[#f7f2ea] via-white to-[#e6f7f1] p-6">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.9),rgba(255,255,255,0))]" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#ffd7a8]/60 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-16 h-72 w-72 rounded-full bg-[#9fe7d4]/70 blur-3xl" />

        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                Extension Marketplace
              </p>
              <h1 className="font-display text-3xl text-slate-900 md:text-4xl">
                Extensions
              </h1>
              <p className="text-sm text-muted-foreground">
                Browse and install extensions from aihub
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Powered by</span>
              <a
                href="https://hub.maldevta.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:underline"
              >
                aihub
                <ExternalLink className="h-3 w-3" />
              </a>
              </div>
            </div>


          {error && (
            <div className="w-full rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Search and Filter */}
          <div className="grid gap-6 md:grid-cols-[1fr_300px]">
            {/* Search Card */}
            <Card className="border-[#e6dccc] bg-white/80 backdrop-blur">
              <CardHeader>
                <CardTitle>Search Extensions</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search extensions..."
                    className="pl-10"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Category Filter */}
            <Card className="border-[#e6dccc] bg-white/80 backdrop-blur">
              <CardHeader>
                <CardTitle>Categories</CardTitle>
                <CardDescription>
                  Filter by category
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <Badge
                      key={cat}
                      variant={selectedCategory === cat ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => setSelectedCategory(cat)}
                    >
                      {cat}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Extensions List */}
          <Card className="border-[#e6dccc] bg-white/80 backdrop-blur">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>All Extensions</CardTitle>
                  <CardDescription>
                    {filteredExtensions.length} extension{filteredExtensions.length !== 1 ? "s" : ""} available
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={loadExtensions}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex h-32 items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                </div>
              ) : filteredExtensions.length === 0 ? (
                <div className="py-12 text-center">
                  <Puzzle className="mx-auto mb-4 h-12 w-12 text-slate-400" />
                  <h3 className="mb-2 text-lg font-semibold text-slate-900">No extensions found</h3>
                  <p className="text-sm text-muted-foreground">
                    {searchQuery ? "Try a different search term" : "No extensions available in this category"}
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredExtensions.map((ext) => (
                    <div
                      key={ext.id}
                      className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 transition-all hover:shadow-md hover:border-slate-300"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                            {ext.enabled ? (
                              <Check className="h-5 w-5 text-emerald-600" />
                            ) : (
                              <div className="h-5 w-5 rounded-full border-2 border-slate-200" />
                            )}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col gap-1">
                            <div>
                              <h3 className="font-semibold text-slate-900">{ext.name}</h3>
                              <p className="text-sm text-slate-600">{ext.description}</p>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <span>v{ext.version || "1.0.0"}</span>
                              <span>by {ext.author || "Maldevta"}</span>
                              <Badge variant="outline" className="text-xs">
                                {ext.category}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {ext.installed_at ? (
                                <>
                                  <span>Installed: {new Date(ext.installed_at).toLocaleDateString()}</span>
                                </>
                              ) : (
                                <span>Available</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant={ext.enabled ? "outline" : "default"}
                            size="sm"
                            onClick={() => handleToggleExtension(ext.id)}
                          >
                            {ext.enabled ? "Disable" : "Enable"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              // Open aihub extension page
                              window.open(`https://hub.maldevta.com/extensions/${ext.id}`, "_blank");
                            }}
                          >
                            <ExternalLink>
                              <Download className="h-4 w-4" />
                            </ExternalLink>
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {user && (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <div className="flex items-center justify-between">
                <span>Signed in as: <span className="font-medium">{user.role}</span></span>
                <span className="font-mono">{user.userId?.slice(0, 8)}...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
