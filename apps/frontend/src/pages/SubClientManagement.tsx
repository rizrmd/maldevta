import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useProjectStore } from "@/stores/projectStore";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/app-layout";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Search,
  Users,
  Link2,
  Copy,
  Edit,
  ExternalLink,
  Trash2,
  Pause,
  Play,
  X,
  Building2,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";
import { MessageCircle as WhatsAppIcon } from "lucide-react";

type ApiError = {
  message: string;
  status?: number;
  code?: string;
};

type SubClientUser = {
  id: number;
  username: string;
  email: string;
  role: string;
};

type SubClient = {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  short_id: string;
  pathname: string;
  registration_enabled: boolean;
  suspended: boolean;
  whatsapp_client_id: string | null;
  users: SubClientUser[];
  created_at: number;
  updated_at: number;
};

type ListSubClientsResponse = {
  success: boolean;
  data: {
    subClients: SubClient[];
    enabled: boolean;
  };
};

type CreateSubClientResponse = {
  success: boolean;
  data: {
    subClient: SubClient;
  };
};

type UpdateSubClientResponse = {
  success: boolean;
  data: {
    subClient: SubClient;
  };
};

async function parseError(response: Response): Promise<ApiError> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (payload && typeof payload === "object") {
    const record = payload as { message?: string; code?: string; error?: string };
    return {
      message: record.error || record.message || `${response.status} ${response.statusText}`,
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

export default function SubClientManagementPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const { currentProject, projects } = useProjectStore();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [subClients, setSubClients] = useState<SubClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubClients, setSelectedSubClients] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  // Form states
  const [createForm, setCreateForm] = useState({ name: "", description: "" });
  const [editForm, setEditForm] = useState({ id: "", name: "", description: "", pathname: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Find project
  const project = currentProject?.id === projectId
    ? currentProject
    : projects.find((p) => p.id === projectId);

  // Check if user is project owner
  const isProjectOwner = project?.created_by_user_id === user?.userId;
  const isAdmin = user?.role === "admin";

  // Load sub-clients
  const loadSubClients = async () => {
    if (!projectId) return;

    setIsLoading(true);
    setError("");
    try {
      const response = await apiRequest<ListSubClientsResponse>(`/projects/${projectId}/sub-clients`);
      setSubClients(response.data.subClients || []);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || "Failed to load sub-clients");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSubClients();
  }, [projectId]);

  // Filter sub-clients based on search
  const filteredSubClients = subClients.filter((subClient) =>
    subClient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    subClient.short_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    subClient.pathname?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Copy URL to clipboard
  const copyUrl = async (subClient: SubClient) => {
    const url = `${window.location.origin}/s/${subClient.short_id}-${subClient.pathname}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(subClient.id);
      toast({
        title: "URL copied",
        description: "Public URL copied to clipboard",
      });
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed to copy",
        description: "Could not copy URL to clipboard",
      });
    }
  };

  // Create sub-client
  const handleCreateSubClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim() || !projectId) {
      toast({
        variant: "destructive",
        title: "Name is required",
        description: "Please enter a name for the sub-client",
      });
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await apiRequest<CreateSubClientResponse>(`/projects/${projectId}/sub-clients`, {
        method: "POST",
        body: JSON.stringify({
          name: createForm.name,
          description: createForm.description || undefined,
        }),
      });

      setSubClients([...subClients, response.data.subClient]);
      setCreateForm({ name: "", description: "" });
      setCreateDialogOpen(false);

      toast({
        title: "Sub-client created!",
        description: `URL: /s/${response.data.subClient.short_id}-${response.data.subClient.pathname}`,
      });
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || "Failed to create sub-client");
      toast({
        variant: "destructive",
        title: "Failed to create",
        description: apiError.message || "An error occurred",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update sub-client
  const handleUpdateSubClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.name.trim() || !projectId) return;

    setIsSubmitting(true);
    setError("");

    try {
      const response = await apiRequest<UpdateSubClientResponse>(
        `/projects/${projectId}/sub-clients/${editForm.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            name: editForm.name,
            description: editForm.description || undefined,
            pathname: editForm.pathname || undefined,
          }),
        }
      );

      setSubClients(
        subClients.map((sc) =>
          sc.id === editForm.id ? response.data.subClient : sc
        )
      );
      setEditDialogOpen(false);

      toast({
        title: "Sub-client updated",
        description: "Sub-client details updated successfully",
      });
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || "Failed to update sub-client");
      toast({
        variant: "destructive",
        title: "Failed to update",
        description: apiError.message || "An error occurred",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete sub-client
  const handleDeleteSubClient = async () => {
    if (!projectId) return;

    setIsSubmitting(true);
    setError("");

    try {
      await apiRequest(`/projects/${projectId}/sub-clients/${editForm.id}`, {
        method: "DELETE",
      });

      setSubClients(subClients.filter((sc) => sc.id !== editForm.id));
      setDeleteDialogOpen(false);

      toast({
        title: "Sub-client deleted",
        description: "Sub-client deleted successfully",
      });
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || "Failed to delete sub-client");
      toast({
        variant: "destructive",
        title: "Failed to delete",
        description: apiError.message || "An error occurred",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle sub-client selection
  const toggleSelection = (id: string, checked: boolean | string) => {
    const newSelection = new Set(selectedSubClients);
    if (checked === true) {
      newSelection.add(id);
    } else {
      newSelection.delete(id);
    }
    setSelectedSubClients(newSelection);
  };

  // Toggle all selection
  const toggleSelectAll = (checked: boolean | string) => {
    if (checked === true) {
      setSelectedSubClients(new Set(filteredSubClients.map((sc) => sc.id)));
    } else {
      setSelectedSubClients(new Set());
    }
  };

  // Bulk status change
  const handleBulkStatusChange = async (suspended: boolean) => {
    if (!projectId || selectedSubClients.size === 0) return;

    setIsSubmitting(true);
    setError("");

    const promises = Array.from(selectedSubClients).map((id) =>
      apiRequest(`/projects/${projectId}/sub-clients/${id}`, {
        method: "PUT",
        body: JSON.stringify({ suspended }),
      })
    );

    try {
      await Promise.all(promises);

      setSubClients(
        subClients.map((sc) =>
          selectedSubClients.has(sc.id) ? { ...sc, suspended } : sc
        )
      );

      toast({
        title: suspended
          ? `Suspended ${selectedSubClients.size} sub-clients`
          : `Activated ${selectedSubClients.size} sub-clients`,
      });

      setSelectedSubClients(new Set());
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || "Failed to update sub-clients");
      toast({
        variant: "destructive",
        title: "Failed to update",
        description: apiError.message || "An error occurred",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    if (!projectId || selectedSubClients.size === 0) return;

    setIsSubmitting(true);
    setError("");

    const promises = Array.from(selectedSubClients).map((id) =>
      apiRequest(`/projects/${projectId}/sub-clients/${id}`, {
        method: "DELETE",
      })
    );

    try {
      await Promise.all(promises);

      setSubClients(subClients.filter((sc) => !selectedSubClients.has(sc.id)));

      toast({
        title: `Deleted ${selectedSubClients.size} sub-clients`,
      });

      setSelectedSubClients(new Set());
      setBulkDeleteDialogOpen(false);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || "Failed to delete sub-clients");
      toast({
        variant: "destructive",
        title: "Failed to delete",
        description: apiError.message || "An error occurred",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if any selected sub-clients are not suspended
  const hasNonSuspended = Array.from(selectedSubClients).some(
    (id) => {
      const sc = subClients.find((s) => s.id === id);
      return sc && !sc.suspended;
    }
  );

  // Open edit dialog
  const openEditDialog = (subClient: SubClient) => {
    setEditForm({
      id: subClient.id,
      name: subClient.name,
      description: subClient.description || "",
      pathname: subClient.pathname,
    });
    setEditDialogOpen(true);
  };

  // Open delete dialog
  const openDeleteDialog = (subClient: SubClient) => {
    setEditForm({
      id: subClient.id,
      name: subClient.name,
      description: subClient.description || "",
      pathname: subClient.pathname,
    });
    setDeleteDialogOpen(true);
  };

  // Show loading state
  if (isLoading) {
    return (
      <AppLayout
        header={
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Sub-Clients</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        }
      >
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Loading sub-clients...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      header={
        <div className="flex items-center justify-between w-full">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Sub-Clients Management</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Header Actions */}
          {selectedSubClients.size > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {selectedSubClients.size} selected
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkStatusChange(true)}
                disabled={isSubmitting}
              >
                <Pause className="h-4 w-4 mr-1" />
                Suspend
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkStatusChange(false)}
                disabled={isSubmitting}
              >
                <Play className="h-4 w-4 mr-1" />
                Activate
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setBulkDeleteDialogOpen(true)}
                disabled={isSubmitting || hasNonSuspended}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedSubClients(new Set())}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search sub-clients..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <Button
                onClick={() => setCreateDialogOpen(true)}
                disabled={!isProjectOwner && !isAdmin}
                size="lg"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Sub-Client
              </Button>
            </div>
          )}
        </div>
      }
    >
      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-hidden">
          <div className="h-full flex flex-col px-4 pt-4 md:px-6 pb-4 overflow-y-auto">
            <div className="w-full max-w-6xl mx-auto space-y-6">

              {/* Error Message */}
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Sub-Clients List */}
              {filteredSubClients.length === 0 ? (
                <Card className="border-[#e6dccc] bg-white/80 backdrop-blur">
                  <CardContent className="py-12 text-center">
                    <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      {searchQuery ? "No matching sub-clients found" : "No sub-clients yet"}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {searchQuery
                        ? "Try a different search term"
                        : "Create your first sub-client to get started"}
                    </p>
                    {!searchQuery && (isProjectOwner || isAdmin) && (
                      <Button onClick={() => setCreateDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Sub-Client
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {/* Select All Checkbox */}
                  {selectedSubClients.size > 0 && (
                    <div className="flex items-center gap-2 px-2">
                      <Checkbox
                        checked={selectedSubClients.size === filteredSubClients.length}
                        onCheckedChange={(checked) => toggleSelectAll(checked)}
                      />
                      <label className="text-sm text-muted-foreground cursor-pointer">
                        Select all ({filteredSubClients.length})
                      </label>
                    </div>
                  )}

                  {/* Sub-Client Cards */}
                  {filteredSubClients.map((subClient) => {
                    const isSelected = selectedSubClients.has(subClient.id);
                    const publicUrl = `/s/${subClient.short_id}-${subClient.pathname}`;
                    const userCount = subClient.users?.length || 0;

                    return (
                      <Card
                        key={subClient.id}
                        className={`border-[#e6dccc] bg-white/80 backdrop-blur transition-all ${
                          subClient.suspended ? "opacity-70 bg-muted/50" : ""
                        } ${isSelected ? "ring-2 ring-primary" : ""}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            {/* Checkbox */}
                            <div className="pt-1">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(checked) => toggleSelection(subClient.id, checked)}
                              />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  {/* Name and Description */}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <button
                                      onClick={() => setLocation(`/sub-clients/${subClient.id}`)}
                                      className="text-lg font-semibold text-slate-900 hover:text-primary transition-colors text-left"
                                    >
                                      {subClient.name}
                                    </button>
                                    {/* Status Badges */}
                                    {subClient.suspended && (
                                      <Badge variant="secondary" className="text-amber-600 bg-amber-50 border-amber-200">
                                        <Pause className="h-3 w-3 mr-1" />
                                        Suspended
                                      </Badge>
                                    )}
                                    {subClient.whatsapp_client_id && (
                                      <Badge variant="secondary" className="text-green-600 bg-green-50 border-green-200">
                                        <WhatsAppIcon className="h-3 w-3 mr-1" />
                                        WhatsApp
                                      </Badge>
                                    )}
                                  </div>

                                  {subClient.description && (
                                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                      {subClient.description}
                                    </p>
                                  )}

                                  {/* Metadata */}
                                  <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-1">
                                      <Users className="h-4 w-4" />
                                      <span>{userCount} user{userCount !== 1 ? "s" : ""}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Link2 className="h-4 w-4" />
                                      <button
                                        onClick={() => window.open(publicUrl, "_blank")}
                                        className="hover:text-primary transition-colors"
                                      >
                                        {publicUrl}
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => copyUrl(subClient)}
                                    title="Copy URL"
                                  >
                                    {copiedId === subClient.id ? (
                                      <span className="text-green-600 text-xs">Copied!</span>
                                    ) : (
                                      <>
                                        <Copy className="h-4 w-4" />
                                        <span className="sr-only">Copy URL</span>
                                      </>
                                    )}
                                  </Button>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="sm">
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => openEditDialog(subClient)}>
                                        <Edit className="h-4 w-4 mr-2" />
                                        Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => setLocation(`/sub-clients/${subClient.id}`)}
                                      >
                                        <ExternalLink className="h-4 w-4 mr-2" />
                                        Manage
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => openDeleteDialog(subClient)}
                                        disabled={!subClient.suspended}
                                        className="text-red-600 focus:text-red-600"
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Sub-Client</DialogTitle>
            <DialogDescription>
              Create a new sub-client within this project. A unique public URL will be generated automatically.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSubClient}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="create-name">Name *</Label>
                <Input
                  id="create-name"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="Marketing Department"
                  autoFocus
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="create-description">Description</Label>
                <Input
                  id="create-description"
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  placeholder="Marketing team conversations"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !createForm.name.trim()}>
                {isSubmitting ? "Creating..." : "Create Sub-Client"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Sub-Client</DialogTitle>
            <DialogDescription>
              Update the sub-client details. Changes will be reflected immediately.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateSubClient}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Name *</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="Marketing Department"
                  autoFocus
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-pathname">Pathname</Label>
                <Input
                  id="edit-pathname"
                  value={editForm.pathname}
                  onChange={(e) => setEditForm({ ...editForm, pathname: e.target.value })}
                  placeholder="marketing-department"
                  pattern="[a-z0-9-]+"
                  title="Lowercase letters, numbers, and hyphens only"
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to auto-generate from name. Use lowercase letters, numbers, and hyphens only.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-description">Description</Label>
                <Input
                  id="edit-description"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  placeholder="Marketing team conversations"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !editForm.name.trim()}>
                {isSubmitting ? "Updating..." : "Update Sub-Client"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sub-Client?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{editForm.name}"? This action cannot be undone.
              All data associated with this sub-client will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSubClient}
              disabled={isSubmitting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSubmitting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedSubClients.size} Sub-Clients?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedSubClients.size} sub-client(s)? This action cannot be undone.
              All data associated with these sub-clients will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isSubmitting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSubmitting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
