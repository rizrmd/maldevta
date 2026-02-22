import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { useProjectStore } from "@/stores/projectStore";
import { useSubClientStore } from "@/stores/subClientStore";
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
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function SubClientSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const { projects, loadProjects, hasInitialized, currentProject, updateProjectSubClientSettings, error } = useProjectStore();
  const { enabled, setEnabled } = useSubClientStore();

  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [isTogglingRegistration, setIsTogglingRegistration] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [project, setProject] = useState(currentProject);

  const { toast } = useToast();

  // Load projects on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        if (!hasInitialized) {
          await loadProjects();
        }
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [hasInitialized, loadProjects]);

  // Find project from list or use currentProject
  useEffect(() => {
    if (currentProject?.id === projectId) {
      setProject(currentProject);
    } else {
      const foundProject = projects.find((p) => p.id === projectId);
      if (foundProject) {
        setProject(foundProject);
      }
    }
  }, [projectId, currentProject, projects]);

  // Check if user is project owner
  const isProjectOwner = project?.created_by_user_id === user?.userId;

  // Sync enabled state from project
  useEffect(() => {
    if (project) {
      const projectEnabled = project.sub_clients_enabled ?? false;
      setEnabled(projectEnabled);
      const projectRegistrationEnabled = project.sub_clients_registration_enabled ?? true;
      setRegistrationEnabled(projectRegistrationEnabled);
    }
  }, [project, setEnabled]);

  const handleToggleSubClients = async (checked: boolean) => {
    if (!project || !isProjectOwner) return;

    setIsToggling(true);
    try {
      await updateProjectSubClientSettings(project.id, {
        sub_clients_enabled: checked,
      });
      setEnabled(checked);
      setProject({ ...project, sub_clients_enabled: checked });
      toast({
        title: checked ? "Sub-clients enabled" : "Sub-clients disabled",
        description: checked
          ? "Sub-client functionality is now active"
          : "Sub-client functionality has been disabled",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed to update setting",
        description: (err as { message?: string })?.message || "An error occurred",
      });
    } finally {
      setIsToggling(false);
    }
  };

  const handleToggleRegistration = async (checked: boolean) => {
    if (!project || !isProjectOwner) return;

    setIsTogglingRegistration(true);
    try {
      await updateProjectSubClientSettings(project.id, {
        sub_clients_registration_enabled: checked,
      });
      setRegistrationEnabled(checked);
      setProject({ ...project, sub_clients_registration_enabled: checked });
      toast({
        title: checked ? "Registration enabled by default" : "Registration disabled by default",
        description: checked
          ? "New sub-clients will allow public registration by default"
          : "New sub-clients will require manual user addition",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed to update setting",
        description: (err as { message?: string })?.message || "An error occurred",
      });
    } finally {
      setIsTogglingRegistration(false);
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <AppLayout
        header={
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Sub-Clients Settings</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        }
      >
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-600" />
            <p className="mt-4 text-sm text-slate-600">Loading...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Show error if project not found
  if (!project) {
    return (
      <AppLayout
        header={
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Sub-Clients Settings</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        }
      >
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-semibold text-red-600">Project not found</p>
            <p className="text-sm text-slate-600 mt-2">Could not find project with ID: {projectId}</p>
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
              <BreadcrumbPage>Sub-Clients Settings</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      }
    >
      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-hidden">
          <div className="h-full flex flex-col items-center px-4 pt-4 md:px-6 pb-4 overflow-y-auto">
            <div className="w-full max-w-3xl space-y-6">

              {/* Page Header */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                    Configuration
                  </p>
                  <h1 className="font-display text-3xl text-slate-900 md:text-4xl">
                    Sub-Clients Settings
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Configure sub-client functionality for this project
                  </p>
                </div>
              </div>

              {/* Error Alert */}
              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Owner-only Alert */}
              {!isProjectOwner && user && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Only the project owner can enable or disable sub-clients.
                  </AlertDescription>
                </Alert>
              )}

              {/* Feature Toggle Card */}
              <Card className="border-[#e6dccc] bg-white/80 backdrop-blur">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Switch
                      checked={enabled}
                      onCheckedChange={handleToggleSubClients}
                      disabled={isToggling || !isProjectOwner}
                    />
                    <span>Enable Sub-Clients</span>
                  </CardTitle>
                  <CardDescription>
                    When enabled, you can create multiple sub-clients within this project,
                    each with their own WhatsApp integration and users.
                    Go to the <span className="font-medium">Management</span> page to create and manage sub-clients.
                  </CardDescription>
                </CardHeader>
              </Card>

              {/* Registration Default Card */}
              {enabled && (
                <Card className="border-[#e6dccc] bg-white/80 backdrop-blur">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Switch
                        checked={registrationEnabled}
                        onCheckedChange={handleToggleRegistration}
                        disabled={isTogglingRegistration || !isProjectOwner}
                      />
                      <span>Enable Registration by Default</span>
                    </CardTitle>
                    <CardDescription>
                      When enabled, new sub-clients will allow public registration by default.
                      You can still disable registration for individual sub-clients in their settings.
                    </CardDescription>
                  </CardHeader>
                </Card>
              )}

              {/* Info Card */}
              <Card className="border-[#e6dccc] bg-white/80 backdrop-blur">
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <h3 className="font-semibold text-sm text-slate-900">About Sub-Clients</h3>
                    <p className="text-sm text-muted-foreground">
                      Sub-clients allow you to create multiple independent client environments
                      within a single project. Each sub-client has its own:
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-1 pl-4 list-disc">
                      <li>WhatsApp integration and phone number</li>
                      <li>User management and authentication</li>
                      <li>Chat history and context</li>
                      <li>Files and memory storage</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
