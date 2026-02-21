import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import AppLayout from "@/components/app-layout";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  MessageCircle as WhatsAppIcon,
  Users,
  ArrowRight,
  Clock,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProjectStore, useUIStore, useAuthStore } from "@/stores";
import type { Project } from "@/stores";

export default function ProjectSelectorPage() {
  const { user } = useAuthStore();
  const [, setLocation] = useLocation();
  const {
    projects,
    isLoading,
    error,
    hasInitialized,
    loadProjects,
    selectProject,
    createProject,
    deleteProject,
    renameProject,
    setError,
  } = useProjectStore();
  const {
    activeDialog,
    dialogData,
    openDialog,
    closeDialog,
  } = useUIStore();

  // State for create/rename forms
  const [projectName, setProjectName] = useState("");
  const [enableWhatsapp, setEnableWhatsapp] = useState(true);
  const [enableSubclients, setEnableSubclients] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load projects on mount
  useEffect(() => {
    if (user?.role === "system") {
      setLocation("/system/tenants");
      return;
    }

    if (!hasInitialized) {
      loadProjects();
    }
  }, [hasInitialized, loadProjects, setLocation, user?.role]);

  if (user?.role === "system") {
    return null;
  }

  const handleSelectProject = (project: Project) => {
    selectProject(project.id);
    // Navigate to chat page with project context
    setLocation(`/chat/${project.id}`);
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) {
      setError("Project name is required");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const project = await createProject(
        projectName.trim(),
        enableWhatsapp,
        enableSubclients
      );
      closeDialog();
      setProjectName("");
      setEnableWhatsapp(true);
      setEnableSubclients(false);
      // Navigate to the new project
      handleSelectProject(project);
    } catch (err) {
      // Error is handled by store
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProject = async (project: Project) => {
    if (!confirm(`Are you sure you want to delete "${project.name}"?`)) {
      return;
    }

    try {
      await deleteProject(project.id);
      closeDialog();
    } catch (err) {
      // Error is handled by store
    }
  };

  const handleRenameProject = async (project: Project, newName: string) => {
    if (!newName.trim()) {
      setError("Project name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      await renameProject(project.id, newName.trim());
      closeDialog();
    } catch (err) {
      // Error is handled by store
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAdmin = user?.role === "admin";
  const projectToDelete = dialogData?.project as Project | undefined;
  const projectToRename = dialogData?.project as Project | undefined;

  return (
    <AppLayout
      header={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Projects</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      }
    >
      <div className="mx-auto grid max-w-6xl gap-6">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                Workspace
              </p>
              <h1 className="font-display text-3xl text-slate-900 md:text-4xl">
                Your Projects
              </h1>
              <p className="text-sm text-muted-foreground">
                Select a project to start chatting or create a new one
              </p>
            </div>
            {isAdmin && (
              <Button onClick={() => openDialog("create-project")} size="lg">
                <Plus className="mr-2 h-4 w-4" />
                New Project
              </Button>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
              <Button
                variant="ghost"
                size="sm"
                className="ml-2 text-red-700 underline"
                onClick={() => setError(null)}
              >
                Dismiss
              </Button>
            </div>
          )}

          {/* Loading state */}
          {isLoading && !hasInitialized ? (
            <div className="flex h-64 items-center justify-center">
              <div className="text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-600" />
                <p className="mt-4 text-sm text-muted-foreground">Loading projects...</p>
              </div>
            </div>
          ) : projects.length === 0 ? (
            /* Empty state */
            <Card className="border-[#e6dccc] bg-white/80 backdrop-blur">
              <CardContent className="flex flex-col items-center justify-center p-12">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                  <Plus className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">No projects yet</h3>
                <p className="mt-2 text-center text-sm text-muted-foreground">
                  {isAdmin
                    ? "Create your first project to get started with AI conversations."
                    : "Waiting for an admin to create a project."}
                </p>
                {isAdmin && (
                  <Button
                    onClick={() => openDialog("create-project")}
                    className="mt-4"
                  >
                    <Plus className="mr-2 h-4 w-4 shrink-0" />
                    Create Project
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            /* Projects grid */
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <Card
                  key={project.id}
                  className="group cursor-pointer border-slate-200 bg-white transition-all hover:shadow-lg hover:border-slate-300"
                  onClick={() => handleSelectProject(project)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="truncate text-lg">
                          {project.name}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-1 text-xs">
                          <Clock className="h-3 w-3" />
                          {new Date(project.created_at).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <ArrowRight className="h-5 w-5 shrink-0 text-slate-400 transition-colors group-hover:text-slate-600" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Features badges */}
                    <div className="flex flex-wrap gap-2">
                      {project.whatsapp_enabled && (
                        <Badge variant="outline" className="text-xs">
                          <WhatsAppIcon className="mr-1 h-3 w-3" />
                          WhatsApp
                        </Badge>
                      )}
                      {project.subclient_enabled && (
                        <Badge variant="outline" className="text-xs">
                          <Users className="mr-1 h-3 w-3" />
                          Subclients
                        </Badge>
                      )}
                      {!project.whatsapp_enabled &&
                        !project.subclient_enabled && (
                          <Badge variant="secondary" className="text-xs">
                            Basic
                          </Badge>
                        )}
                    </div>

                    {/* Project ID */}
                    <div className="rounded-md bg-slate-50 px-2 py-1 text-xs font-mono text-slate-600">
                      ID: {project.id.slice(0, 8)}...
                    </div>

                    {/* Admin actions */}
                    {isAdmin && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              openDialog("rename-project", { project });
                            }}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDialog("delete-project", { project });
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* User info footer */}
          {user && (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <div className="flex items-center justify-between">
                <span>
                  Signed in as: <span className="font-medium">{user.role}</span>
                </span>
                <span className="font-mono">{user.userId?.slice(0, 8)}...</span>
              </div>
            </div>
          )}
        </div>

      {/* Create Project Dialog */}
      <Dialog
        open={activeDialog === "create-project"}
        onOpenChange={(open: boolean) => !open && closeDialog()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Configure your new AI project with optional features
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateProject} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name</Label>
              <Input
                id="project-name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="My AI Project"
                autoFocus
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">Features</Label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableWhatsapp}
                    onChange={(e) => setEnableWhatsapp(e.target.checked)}
                    disabled={isSubmitting}
                    className="h-4 w-4 rounded"
                  />
                  Enable WhatsApp Integration
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableSubclients}
                    onChange={(e) => setEnableSubclients(e.target.checked)}
                    disabled={isSubmitting}
                    className="h-4 w-4 rounded"
                  />
                  Enable Subclients
                </label>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !projectName.trim()}>
                {isSubmitting ? "Creating..." : "Create Project"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rename Project Dialog */}
      <Dialog
        open={activeDialog === "rename-project"}
        onOpenChange={(open: boolean) => !open && closeDialog()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Project</DialogTitle>
            <DialogDescription>
              Enter a new name for "{projectToRename?.name}"
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              handleRenameProject(
                projectToRename!,
                formData.get("new-name") as string
              );
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="new-name">New Name</Label>
              <Input
                id="new-name"
                name="new-name"
                defaultValue={projectToRename?.name}
                placeholder="New project name"
                autoFocus
                disabled={isSubmitting}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Renaming..." : "Rename"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Project Dialog */}
      <Dialog
        open={activeDialog === "delete-project"}
        onOpenChange={(open: boolean) => !open && closeDialog()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{projectToDelete?.name}"? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeDialog}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => projectToDelete && handleDeleteProject(projectToDelete)}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
