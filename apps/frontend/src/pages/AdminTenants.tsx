import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useTenantStore } from "@/stores/tenantStore";
import type { Tenant } from "@/stores/tenantStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Plus,
  Edit,
  Trash2,
  Users,
  Globe,
  Loader2,
} from "lucide-react";

export function AdminTenantsPage() {
  const [, setLocation] = useLocation();
  const { tenants, isLoading, error, fetchTenants, deleteTenant } =
    useTenantStore();

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);
  const handleDeleteTenant = async (tenant: Tenant) => {
    if (!confirm(`Delete tenant "${tenant.name}"? This cannot be undone.`)) return;
    setIsSubmitting(true);
    await deleteTenant(tenant.id);
    setIsSubmitting(false);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="h-screen overflow-auto bg-background flex flex-col">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <div>
              <h1 className="text-xl font-semibold">Tenant Management</h1>
              <p className="text-sm text-muted-foreground">
                Manage your platform tenants
              </p>
            </div>
          </div>
          <Button onClick={() => setLocation("/system/tenants/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Create Tenant
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {error && (
            <div className="mb-4 p-4 bg-destructive/10 text-destructive rounded-lg">
              {error}
            </div>
          )}

          {isLoading && tenants.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : tenants.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">No tenants found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Create your first tenant to get started
                </p>
              </div>
            </div>
          ) : (
            <div className="border rounded-lg">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Tenant
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Domain
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {tenants.map((tenant) => (
                      <tr
                        key={tenant.id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {tenant.has_logo ? (
                              <img
                                src={`/system/tenants/${tenant.id}/logo`}
                                alt={`${tenant.name} logo`}
                                className="h-10 w-10 rounded-lg border object-cover"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Building2 className="h-5 w-5 text-primary" />
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">
                                  {tenant.name}
                                </span>
                                {tenant.is_default && (
                                  <Badge variant="secondary" className="text-xs">
                                    Default
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                ID: {tenant.id.slice(0, 12)}...
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {tenant.domain && tenant.domain !== "*" ? (
                            <div className="flex items-center gap-2">
                              <Globe className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{tenant.domain}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              Any domain (*)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-muted-foreground">
                            {formatDate(tenant.created_at)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex gap-1 justify-end">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setLocation(`/system/tenants/${tenant.id}/users`)}
                              title="Manage users"
                            >
                              <Users className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setLocation(`/system/tenants/${tenant.id}/edit`)}
                              title="Edit tenant"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {!tenant.is_default && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => handleDeleteTenant(tenant)}
                                title="Delete tenant"
                                disabled={isSubmitting}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
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
    </div>
  );
}
