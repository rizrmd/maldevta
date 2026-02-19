import { useEffect, useState } from "react";
import { useTenantStore } from "@/stores/tenantStore";
import type { Tenant } from "@/stores/tenantStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { TenantUsersDialog } from "@/components/admin/tenant-users-dialog";

export function AdminTenantsPage() {
  const { tenants, isLoading, error, fetchTenants, createTenant, updateTenant, deleteTenant } =
    useTenantStore();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [usersDialogOpen, setUsersDialogOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  const resetForm = () => {
    setName("");
    setDomain("");
    useTenantStore.getState().setError(null);
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const success = await createTenant(name, domain);
    setIsSubmitting(false);
    if (success) {
      resetForm();
      setCreateDialogOpen(false);
    }
  };

  const handleEditTenant = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setName(tenant.name);
    setDomain(tenant.domain);
    setEditDialogOpen(true);
  };

  const handleUpdateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant) return;
    setIsSubmitting(true);
    const success = await updateTenant(selectedTenant.id, name, domain);
    setIsSubmitting(false);
    if (success) {
      resetForm();
      setEditDialogOpen(false);
      setSelectedTenant(null);
    }
  };

  const handleDeleteTenant = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedTenant) return;
    setIsSubmitting(true);
    const success = await deleteTenant(selectedTenant.id);
    setIsSubmitting(false);
    if (success) {
      setDeleteDialogOpen(false);
      setSelectedTenant(null);
    }
  };

  const handleManageUsers = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setUsersDialogOpen(true);
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
          <Button onClick={() => setCreateDialogOpen(true)}>
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
                              onClick={() => handleManageUsers(tenant)}
                              title="Manage users"
                            >
                              <Users className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleEditTenant(tenant)}
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

      {/* Create Tenant Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Tenant</DialogTitle>
            <DialogDescription>
              Create a new tenant for your platform
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleCreateTenant} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-name">Name</Label>
              <Input
                id="create-name"
                placeholder="My Organization"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-domain">Domain</Label>
              <Input
                id="create-domain"
                placeholder="organization.example.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to allow any domain (*)
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetForm();
                  setCreateDialogOpen(false);
                }}
                className="flex-1"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? (
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
        </DialogContent>
      </Dialog>

      {/* Edit Tenant Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Tenant</DialogTitle>
            <DialogDescription>
              Update tenant information
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleUpdateTenant} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                placeholder="My Organization"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-domain">Domain</Label>
              <Input
                id="edit-domain"
                placeholder="organization.example.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to allow any domain (*)
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetForm();
                  setEditDialogOpen(false);
                  setSelectedTenant(null);
                }}
                className="flex-1"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? (
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
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Tenant</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this tenant? This will also delete
              all users, projects, and data associated with this tenant. This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {selectedTenant && (
            <div className="py-4">
              <div className="bg-muted p-4 rounded-lg">
                <div className="font-medium">{selectedTenant.name}</div>
                {selectedTenant.domain && selectedTenant.domain !== "*" && (
                  <div className="text-sm text-muted-foreground">
                    Domain: {selectedTenant.domain}
                  </div>
                )}
                <div className="text-sm text-muted-foreground mt-1">
                  ID: {selectedTenant.id.slice(0, 20)}...
                </div>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setSelectedTenant(null);
              }}
              className="flex-1"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              className="flex-1"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Tenant"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage Users Dialog */}
      {selectedTenant && (
        <TenantUsersDialog
          open={usersDialogOpen}
          onOpenChange={setUsersDialogOpen}
          tenant={selectedTenant}
        />
      )}
    </div>
  );
}
