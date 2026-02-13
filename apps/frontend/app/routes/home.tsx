import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/home";
import { Button, buttonVariants } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Select } from "~/components/ui/select";
import { cn } from "~/lib/utils";
import {
  createProject,
  createSubclient,
  getSessionStatus,
  listProjects,
  listSubclients,
  logout,
  type Project,
  type SessionStatus,
  type Subclient,
} from "~/lib/iam-api";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "AICore" },
    { name: "description", content: "AICore auth and tenant dashboard" },
  ];
}

export default function Home() {
  const [session, setSession] = useState<SessionStatus | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [subclients, setSubclients] = useState<Subclient[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [projectName, setProjectName] = useState("");
  const [enableWhatsapp, setEnableWhatsapp] = useState(false);
  const [enableSubclients, setEnableSubclients] = useState(false);

  const [subclientName, setSubclientName] = useState("");
  const [subclientDomain, setSubclientDomain] = useState("");
  const [subclientAdminUsername, setSubclientAdminUsername] = useState("");
  const [subclientAdminPassword, setSubclientAdminPassword] = useState("");

  async function loadSessionAndData() {
    setLoading(true);
    setError(null);
    try {
      const currentSession = await getSessionStatus();
      setSession(currentSession);

      if (currentSession.scope_type === "tenant") {
        const tenantProjects = await listProjects();
        setProjects(tenantProjects);

        const firstProjectId = selectedProjectId || tenantProjects[0]?.id || "";
        setSelectedProjectId(firstProjectId);

        if (firstProjectId) {
          const list = await listSubclients(firstProjectId);
          setSubclients(list);
        } else {
          setSubclients([]);
        }
      }
    } catch {
      setSession(null);
      setProjects([]);
      setSubclients([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSessionAndData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!session || session.scope_type !== "tenant" || !selectedProjectId) {
      return;
    }
    void listSubclients(selectedProjectId)
      .then(setSubclients)
      .catch(() => setSubclients([]));
  }, [session, selectedProjectId]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  async function onCreateProject(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createProject({
        name: projectName,
        enable_whatsapp: enableWhatsapp,
        enable_subclients: enableSubclients,
      });
      setProjectName("");
      setEnableWhatsapp(false);
      setEnableSubclients(false);
      await loadSessionAndData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    }
  }

  async function onCreateSubclient(e: FormEvent) {
    e.preventDefault();
    if (!selectedProjectId) {
      setError("Select a project first");
      return;
    }

    setError(null);
    try {
      await createSubclient({
        project_id: selectedProjectId,
        name: subclientName,
        domain: subclientDomain,
        admin_username: subclientAdminUsername,
        admin_password: subclientAdminPassword,
      });
      setSubclientName("");
      setSubclientDomain("");
      setSubclientAdminUsername("");
      setSubclientAdminPassword("");
      const nextSubclients = await listSubclients(selectedProjectId);
      setSubclients(nextSubclients);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create subclient");
    }
  }

  async function onLogout() {
    await logout();
    await loadSessionAndData();
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <p>Loading...</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-semibold">AICore</h1>
        <p className="mt-2 text-sm text-gray-600">Please sign in or install license.</p>
        <div className="mt-6 flex gap-4 text-sm">
          <Link className={cn(buttonVariants({ variant: "link", size: "sm" }), "h-auto p-0 text-sm")} to="/install">
            Initial setup
          </Link>
          <Link className={cn(buttonVariants({ variant: "link", size: "sm" }), "h-auto p-0 text-sm")} to="/login">
            Tenant login
          </Link>
          <Link className={cn(buttonVariants({ variant: "link", size: "sm" }), "h-auto p-0 text-sm")} to="/subclient-login">
            Subclient login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">
            Role: {session.role} · Scope: {session.scope_type}
          </p>
        </div>
        <Button
          onClick={onLogout}
          variant="outline"
          size="sm"
        >
          Logout
        </Button>
      </div>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      {session.scope_type === "subclient" ? (
        <section className="mt-8 rounded-md border border-gray-200 p-4">
          <h2 className="font-medium">Subclient Workspace</h2>
          <p className="mt-2 text-sm text-gray-600">
            You are scoped to subclient {session.subclient_id}. Access is isolated
            from tenant/project users.
          </p>
        </section>
      ) : null}

      {session.scope_type === "tenant" ? (
        <>
          <section className="mt-8 rounded-md border border-gray-200 p-4">
            <h2 className="font-medium">Projects</h2>
            {projects.length === 0 ? (
              <p className="mt-2 text-sm text-gray-600">No projects yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {projects.map((project) => (
                  <li
                    key={project.id}
                    className="rounded border border-gray-200 px-3 py-2 text-sm"
                  >
                    <div className="font-medium">{project.name}</div>
                    <div className="text-gray-600">
                      WhatsApp: {project.whatsapp_enabled ? "enabled" : "disabled"}
                      {" · "}
                      Subclient: {project.subclient_enabled ? "enabled" : "disabled"}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {session.role === "admin" ? (
            <section className="mt-6 grid gap-6 md:grid-cols-2">
              <form className="rounded-md border border-gray-200 p-4" onSubmit={onCreateProject}>
                <h3 className="font-medium">Create Project</h3>
                <div className="mt-3 space-y-3">
                  <Input
                    placeholder="Project name"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    required
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={enableWhatsapp}
                      onChange={(e) => setEnableWhatsapp(e.target.checked)}
                    />
                    Enable WhatsApp
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={enableSubclients}
                      onChange={(e) => setEnableSubclients(e.target.checked)}
                    />
                    Enable Subclient
                  </label>
                  <Button size="sm" type="submit">
                    Create
                  </Button>
                </div>
              </form>

              <form className="rounded-md border border-gray-200 p-4" onSubmit={onCreateSubclient}>
                <h3 className="font-medium">Create Subclient</h3>
                <div className="mt-3 space-y-3">
                  <Select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                  >
                    <option value="">Select project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </Select>
                  <Input
                    placeholder="Subclient name"
                    value={subclientName}
                    onChange={(e) => setSubclientName(e.target.value)}
                    required
                  />
                  <Input
                    placeholder="Subclient domain"
                    value={subclientDomain}
                    onChange={(e) => setSubclientDomain(e.target.value)}
                    required
                  />
                  <Input
                    placeholder="Subclient admin username"
                    value={subclientAdminUsername}
                    onChange={(e) => setSubclientAdminUsername(e.target.value)}
                    required
                  />
                  <Input
                    placeholder="Subclient admin password"
                    type="password"
                    value={subclientAdminPassword}
                    onChange={(e) => setSubclientAdminPassword(e.target.value)}
                    required
                  />
                  <Button size="sm" type="submit">
                    Create
                  </Button>
                </div>
              </form>
            </section>
          ) : null}

          <section className="mt-6 rounded-md border border-gray-200 p-4">
            <h3 className="font-medium">Subclients</h3>
            {selectedProject ? (
              <p className="mt-1 text-sm text-gray-600">Project: {selectedProject.name}</p>
            ) : null}
            {subclients.length === 0 ? (
              <p className="mt-2 text-sm text-gray-600">No subclients for selected project.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {subclients.map((subclient) => (
                  <li key={subclient.id} className="rounded border border-gray-200 px-3 py-2 text-sm">
                    <div className="font-medium">{subclient.name}</div>
                    <div className="text-gray-600">{subclient.domain}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
