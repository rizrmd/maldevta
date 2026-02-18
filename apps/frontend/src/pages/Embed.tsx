import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import AppLayout from "@/components/app-layout";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Globe } from "lucide-react";

type ProjectResponse = {
  id: string;
  name: string;
};

type ListProjectsResponse = {
  projects: ProjectResponse[];
};

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
    throw new Error(`API Error: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export default function EmbedRedirectorPage() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadProjectsAndRedirect = async () => {
      try {
        const response = await apiRequest<ListProjectsResponse>("/projects");
        const projectList = response.projects || [];

        if (projectList.length > 0) {
          // Redirect to first project's Embed page
          setLocation(`/projects/${projectList[0].id}/embed`);
        } else {
          setLoading(false);
          setError("No projects found. Please create a project first.");
        }
      } catch (err) {
        setLoading(false);
        setError(err instanceof Error ? err.message : "Failed to load projects");
      }
    };

    loadProjectsAndRedirect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
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
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-600" />
            <p className="mt-4 text-sm text-slate-600">Loading...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error) {
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
        <div className="flex items-center justify-center h-full">
          <div className="text-center max-w-md">
            <Globe className="mx-auto h-12 w-12 text-slate-400" />
            <h3 className="mt-4 text-lg font-semibold text-slate-900">No Projects Found</h3>
            <p className="mt-2 text-sm text-slate-600">{error}</p>
            <button
              onClick={() => setLocation("/projects")}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Create Project
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return null; // Will redirect before showing this
}
