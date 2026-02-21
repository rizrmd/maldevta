import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTenantStore } from "@/stores/tenantStore";
import { useAuthStore } from "@/stores/authStore";
import { ArrowLeft, Loader2, LogOut, UserPlus } from "lucide-react";

type UserRole = "admin" | "user";

export default function SystemTenantUserCreatePage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params?.tenantId || "";
  const [, setLocation] = useLocation();
  const logout = useAuthStore((state) => state.logout);
  const { tenants, fetchTenants, createTenantUser, error, setError } = useTenantStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<UserRole>("user");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!tenants.length) fetchTenants();
  }, [fetchTenants, tenants.length]);

  const tenant = tenants.find((t) => t.id === tenantId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setSubmitting(true);
    const success = await createTenantUser(tenantId, "", username, password, role);
    setSubmitting(false);
    if (success) {
      setLocation(`/system/tenants/${tenantId}/users`);
    }
  };

  const handleLogout = async () => {
    await logout();
    setLocation("/login", { replace: true });
  };

  return (
    <div className="h-screen overflow-auto bg-background">
      <div className="border-b bg-card">
        <div className="flex items-center gap-3 px-6 py-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation(`/system/tenants/${tenantId}/users`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <UserPlus className="h-5 w-5 text-muted-foreground" />
          <div>
            <h1 className="text-xl font-semibold">Add Tenant User</h1>
            <p className="text-sm text-muted-foreground">{tenant ? tenant.name : "Tenant user"}</p>
          </div>
          <div className="ml-auto">
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-6 py-8">
        <div className="rounded-lg border bg-card p-6">
          {error && <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setLocation(`/system/tenants/${tenantId}/users`)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create User"
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
