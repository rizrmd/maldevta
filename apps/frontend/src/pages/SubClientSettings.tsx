import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { useProjectStore } from "@/stores/projectStore";
import SubClientSettingsComponent from "@/components/pages/sub-client-settings";

export default function SubClientSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { projects, loadProjects, hasInitialized } = useProjectStore();
  const [isLoading, setIsLoading] = useState(true);

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

  // Find project from list
  const project = projects?.find((p) => p.id === projectId);

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-600" />
          <p className="mt-4 text-sm text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show error if project not found
  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-lg font-semibold text-red-600">Project not found</p>
          <p className="text-sm text-slate-600 mt-2">Could not find project with ID: {projectId}</p>
        </div>
      </div>
    );
  }

  return <SubClientSettingsComponent projectId={projectId ?? ""} />;
}
