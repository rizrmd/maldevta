import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTenantStore } from "@/stores/tenantStore";
import { ArrowLeft, Building2, Loader2 } from "lucide-react";

export default function SystemTenantCreatePage() {
  const [, setLocation] = useLocation();
  const { createTenant, error, setError } = useTenantStore();
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const tenant = await createTenant(name, domain);
    setSubmitting(false);
    if (tenant) {
      setLocation("/system/tenants");
    }
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
            <h1 className="text-xl font-semibold">Create Tenant</h1>
            <p className="text-sm text-muted-foreground">Add a new tenant to your platform</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-6 py-8">
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
                    Creating...
                  </>
                ) : (
                  "Create Tenant"
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
