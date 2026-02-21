import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTenantStore } from "@/stores/tenantStore";
import type { User } from "@/stores/tenantStore";
import { useAuthStore } from "@/stores/authStore";
import { ArrowLeft, Loader2, LogOut, Shield, Trash2, UserPlus, Users } from "lucide-react";

export default function SystemTenantUsersPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params?.tenantId || "";
  const [, setLocation] = useLocation();
  const logout = useAuthStore((state) => state.logout);
  const { tenants, users, isLoading, error, fetchTenants, fetchTenantUsers, deleteTenantUser } = useTenantStore();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!tenants.length) {
      fetchTenants();
    }
    if (tenantId) {
      fetchTenantUsers(tenantId);
    }
  }, [fetchTenants, fetchTenantUsers, tenantId, tenants.length]);

  const tenant = tenants.find((t) => t.id === tenantId);

  const handleDeleteUser = async (user: User) => {
    if (!tenantId) return;
    if (!confirm(`Delete user "${user.username}"?`)) return;
    setSubmitting(true);
    await deleteTenantUser(tenantId, user.id);
    setSubmitting(false);
  };

  const handleLogout = async () => {
    await logout();
    setLocation("/login", { replace: true });
  };

  const formatDate = (timestamp: number) =>
    new Date(timestamp * 1000).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  return (
    <div className="h-screen overflow-auto bg-background">
      <div className="border-b bg-card">
        <div className="flex items-center gap-3 px-6 py-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/system/tenants")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Users className="h-5 w-5 text-muted-foreground" />
          <div>
            <h1 className="text-xl font-semibold">Tenant Users</h1>
            <p className="text-sm text-muted-foreground">{tenant ? tenant.name : "Loading tenant..."}</p>
          </div>
          <div className="ml-auto">
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </Button>
              <Button onClick={() => setLocation(`/system/tenants/${tenantId}/users/new`)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Add User
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        {error && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

        {!tenant && isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !tenant ? (
          <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Tenant not found.</div>
        ) : (
          <div className="rounded-lg border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Created</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 text-sm font-medium">{user.username}</td>
                      <td className="px-4 py-3">
                        <Badge variant={user.role === "admin" ? "default" : "secondary"} className="gap-1">
                          <Shield className="h-3 w-3" />
                          {user.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(user.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setLocation(`/system/tenants/${tenantId}/users/${user.id}/edit`)}
                          >
                            Edit
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteUser(user)} disabled={submitting}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
