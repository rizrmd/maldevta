import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTenantStore } from "@/stores/tenantStore";
import { useAuthStore } from "@/stores/authStore";
import { ArrowLeft, Building2, Loader2, LogOut } from "lucide-react";

export default function SystemTenantEditPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params?.tenantId || "";
  const [, setLocation] = useLocation();
  const logout = useAuthStore((state) => state.logout);
  const { tenants, fetchTenants, updateTenant, isLoading, error, setError } = useTenantStore();
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!tenants.length) {
      fetchTenants();
    }
  }, [fetchTenants, tenants.length]);

  const tenant = tenants.find((t) => t.id === tenantId);

  useEffect(() => {
    if (tenant) {
      setName(tenant.name);
      setDomain(tenant.domain === "*" ? "" : tenant.domain);
    }
  }, [tenant]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    setSubmitting(true);
    setError(null);
    const success = await updateTenant(tenantId, name, domain);
    setSubmitting(false);
    if (success) {
      setLocation("/system/tenants");
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
          <Button variant="ghost" size="icon" onClick={() => setLocation("/system/tenants")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <div>
            <h1 className="text-xl font-semibold">Edit Tenant</h1>
            <p className="text-sm text-muted-foreground">Update tenant details</p>
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
        {!tenant && isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !tenant ? (
          <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
            Tenant not found.
          </div>
        ) : (
          <div className="rounded-lg border bg-card p-6">
            {error && (
              <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tenant-name">Name</Label>
                <Input
                  id="tenant-name"
                  placeholder="My Organization"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tenant-domain">Domain</Label>
                <Input
                  id="tenant-domain"
                  placeholder="organization.example.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Leave empty to allow any domain (*)</p>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setLocation("/system/tenants")}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
